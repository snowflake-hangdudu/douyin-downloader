import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const { create } = createRequire(import.meta.url)('../lib/download-client.js');
const progress = { ok: true, state: 'in_progress', bytesReceived: 3, totalBytes: 10, exists: true };
const complete = { ...progress, state: 'complete', bytesReceived: 10, mime: 'video/mp4' };
const job = () => ({ urls: ['https://a.douyinvod.com/one', 'https://b.douyinvod.com/two'], filename: 'test.mp4' });

test('waits for complete, never treats downloadId as success', async () => {
  const calls = [], seen = [];
  const states = [progress, { ...progress, bytesReceived: 7 }, complete];
  const client = create({ send: async (msg) => { calls.push(msg.type); return msg.type.endsWith('SAVE_DIRECT') ? { ok: true, downloadId: 5 } : states.shift(); }, sleep: async () => {} });
  assert.equal((await client.download(job(), (s) => seen.push(s.state))).state, 'complete');
  assert.deepEqual(seen, ['in_progress', 'in_progress', 'complete']);
  assert.equal(calls.filter((s) => s.endsWith('MEDIA_STATE')).length, 3);
});
test('interrupted source retries next address; user cancellation never retries', async () => {
  for (const code of ['NETWORK_FAILED', 'USER_CANCELED', 'FILE_NO_SPACE', 'FILE_BLOCKED']) {
    let started = 0;
    const client = create({ send: async (msg) => msg.type.endsWith('SAVE_DIRECT') ? { ok: true, downloadId: ++started } : started === 1 ? { ok: true, state: 'interrupted', error: code } : complete, sleep: async () => {} });
    if (code === 'NETWORK_FAILED') { await client.download(job()); assert.equal(started, 2); }
    else { await assert.rejects(client.download(job()), new RegExp(code)); assert.equal(started, 1); }
  }
});
test('cancels download even when cancel was clicked before downloadId arrived', async () => {
  const current = job(); let cancelled;
  const client = create({ send: async (msg) => {
    if (msg.type.endsWith('SAVE_DIRECT')) { current.cancelRequested = true; return { ok: true, downloadId: 8 }; }
    cancelled = msg.downloadId; assert.equal(msg.type, 'DOUYIN_DL_CANCEL_MEDIA'); return { ok: true };
  }});
  await assert.rejects(client.download(current), /已取消/); assert.equal(cancelled, 8);
});
test('unknown state failure never duplicates a possibly active download', async () => {
  let starts = 0;
  const client = create({ send: async (msg) => msg.type.endsWith('SAVE_DIRECT') ? { ok: true, downloadId: ++starts } : { ok: false, error: 'worker unavailable' } });
  await assert.rejects(client.download(job()), /worker unavailable/); assert.equal(starts, 1);
});
test('paused download is not treated as a stalled download', async () => {
  let time = 0, reads = 0;
  const client = create({ now: () => time, sleep: async () => { time += 200000; }, send: async (msg) => {
    if (msg.type.endsWith('SAVE_DIRECT')) return { ok: true, downloadId: 1 };
    assert.equal(msg.type, 'DOUYIN_DL_MEDIA_STATE');
    return ++reads < 4 ? { ...progress, paused: true } : complete;
  }});
  await client.download(job()); assert.equal(reads, 4);
});
test('save-as failure does not repeatedly open save dialogs', async () => {
  let starts = 0;
  const client = create({ send: async (msg) => msg.type.endsWith('SAVE_DIRECT') ? { ok: true, downloadId: ++starts } : { ok: true, state: 'interrupted', error: 'NETWORK_FAILED' } });
  await assert.rejects(client.download({ ...job(), saveAs: true }), /NETWORK_FAILED/); assert.equal(starts, 1);
});
test('HTML/JSON response and removed file do not count as successful media', async () => {
  for (const state of [{ ...complete, mime: 'text/html' }, { ...complete, mime: 'application/json' }, { ...complete, exists: false }]) {
    const client = create({ send: async (msg) => msg.type.endsWith('SAVE_DIRECT') ? { ok: true, downloadId: 1 } : state });
    await assert.rejects(client.download(job()), /错误页面|已被移除/);
  }
});

test('cancel arriving after completion preserves successful result', async () => {
  const current = job(); current.cancelRequested = true; current.downloadId = 17;
  const client = create({ send: async () => complete });
  assert.equal((await client.monitor(current)).state, 'complete');
  assert.equal(current.cancelRequested, false);
});
