import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const agentSource = readFileSync(new URL('../content/page-agent.js', import.meta.url), 'utf8');

function harness(fetchImpl, options = {}) {
  const start = agentSource.indexOf('  function createSession(jobId)');
  const end = agentSource.indexOf('  async function handleDownload');
  assert.ok(start >= 0 && end > start, '应能截取页内取流实现');
  const context = vm.createContext({
    Blob,
    AbortController,
    Headers,
    performance,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    window: { postMessage() {} },
    location: { href: 'https://www.douyin.com/video/1', origin: 'https://www.douyin.com' },
    parse: { unwrapPlayUrl: (url) => String(url || '') },
    sessions: new Map(),
    cancelledBeforeStart: new Set(),
    PROGRESS_REPORT_INTERVAL_MS: 150,
    STALL_MS: options.stallMs ?? 40,
    AGENT: 'douyin-dl-agent',
    mediaCredentials: () => 'omit',
    log() {},
    shortPath: (url) => String(url || '').slice(0, 48)
  });
  vm.runInContext(agentSource.slice(start, end), context);
  return {
    context,
    session: context.createSession(options.jobId || 'job-test')
  };
}

function okBody(chunks, contentLength) {
  let index = 0;
  const total = contentLength ?? chunks.reduce((sum, part) => sum + part.byteLength, 0);
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'content-type': 'video/mp4',
      'content-length': String(total)
    }),
    body: {
      getReader: () => ({
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          const value = chunks[index];
          index += 1;
          return { done: false, value };
        },
        releaseLock() {}
      })
    }
  };
}

test('withStallTimeout aborts controller on timeout', async () => {
  const { context } = harness(async () => okBody([new Uint8Array(8)]));
  const controller = new AbortController();
  await assert.rejects(context.withStallTimeout(new Promise(() => {}), controller, 5), /停滞超时|超时/);
  assert.equal(controller.signal.aborted, true);
});

test('mid-body stall switches to the next media url', async () => {
  let calls = 0;
  const { context, session } = harness(async (url) => {
    calls += 1;
    if (calls === 1) {
      let reads = 0;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '64' }),
        body: {
          getReader: () => ({
            async read() {
              reads += 1;
              if (reads === 1) return { done: false, value: new Uint8Array(8) };
              return new Promise(() => {});
            },
            releaseLock() {}
          })
        }
      };
    }
    assert.match(String(url), /backup/);
    return okBody([new Uint8Array(32)]);
  }, { stallMs: 30 });

  const blob = await context.fetchMedia(session, [
    'https://v3.douyinvod.com/stall.mp4',
    'https://v3.douyinvod.com/backup.mp4'
  ]);
  assert.equal(calls, 2);
  assert.equal(blob.size, 32);
});

test('pause longer than stall timeout can still resume without failing the download', async () => {
  let calls = 0;
  const { context, session } = harness(async () => {
    calls += 1;
    let reads = 0;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '24' }),
      body: {
        getReader: () => ({
          async read() {
            reads += 1;
            if (calls === 1 && reads === 1) return { done: false, value: new Uint8Array(8) };
            if (calls === 1) return new Promise(() => {});
            if (reads === 1) return { done: false, value: new Uint8Array(8) };
            if (reads === 2) return { done: false, value: new Uint8Array(16) };
            return { done: true, value: undefined };
          },
          releaseLock() {}
        })
      }
    };
  }, { stallMs: 25 });

  const pending = context.fetchOne(session, 'https://v3.douyinvod.com/pause.mp4');
  await new Promise((resolve) => setTimeout(resolve, 10));
  context.pauseDownload(session.jobId);
  await new Promise((resolve) => setTimeout(resolve, 60));
  context.resumeDownload(session.jobId);
  const blob = await pending;
  assert.ok(calls >= 1);
  assert.equal(blob.size, 24);
});

test('cancel during stall does not retry backup urls', async () => {
  let calls = 0;
  const { context, session } = harness(async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4', 'content-length': '64' }),
      body: {
        getReader: () => ({
          async read() {
            return new Promise(() => {});
          },
          releaseLock() {}
        })
      }
    };
  }, { stallMs: 80 });

  const pending = context.fetchMedia(session, [
    'https://v3.douyinvod.com/a.mp4',
    'https://v3.douyinvod.com/b.mp4'
  ]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  context.cancelDownload(session.jobId);
  await assert.rejects(pending, /已取消/);
  assert.equal(calls, 1);
});
