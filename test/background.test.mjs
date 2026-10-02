import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../background.js', import.meta.url), 'utf8');
const sender = { id: 'extension-id', url: 'https://www.douyin.com/video/7653794808998426996', tab: { id: 3, url: 'https://www.douyin.com/video/7653794808998426996' } };

function createWorker({ items = {}, failHosts = [], shareInfos = [], firefox = false, blankExtensionId = false, session = {}, determineBeforeCallback = false } = {}) {
  let listener;
  let filenameListener;
  let changedListener;
  let nextId = 40;
  const calls = { download: [], pause: [], resume: [], cancel: [], show: [], tabs: [], suggestions: [] };
  const chrome = {
    storage: { session: {
      async get() { return { ...session }; },
      async set(value) { Object.assign(session, value); },
      async remove(key) { delete session[key]; }
    } },
    runtime: { id: 'extension-id', lastError: null, onMessage: { addListener(fn) { listener = fn; } } },
    downloads: {
      onDeterminingFilename: firefox ? undefined : { addListener(fn) { filenameListener = fn; } },
      onChanged: { addListener(fn) { changedListener = fn; } },
      download(options, done) {
        calls.download.push(options);
        if (failHosts.includes(new URL(options.url).hostname)) { chrome.runtime.lastError = { message: 'network failed' }; done(); chrome.runtime.lastError = null; return; }
        const id = nextId++;
        items[id] = { id, byExtensionId: blankExtensionId ? '' : 'extension-id', state: 'in_progress', bytesReceived: 12, totalBytes: 100, paused: false, canResume: true, filename: options.filename, exists: false, mime: 'video/mp4' };
        if (determineBeforeCallback) {
          calls.suggestions.push(new Promise((resolve) => filenameListener({ ...items[id], url: options.url, filename: 'random-uuid.mp4' }, resolve)));
        }
        done(id);
      },
      async search({ id }) { return items[id] ? [items[id]] : []; },
      async pause(id) { calls.pause.push(id); items[id].paused = true; },
      async resume(id) { calls.resume.push(id); items[id].paused = false; },
      async cancel(id) { calls.cancel.push(id); items[id].state = 'interrupted'; },
      async show(id) { calls.show.push(id); }
    },
    tabs: { async create(value) { calls.tabs.push(value); return { id: 9 }; } }
  };
  const context = {
    chrome, browser: firefox ? { runtime: {} } : undefined, URL, Set, Promise, AbortSignal, console,
    self: { DouyinDlParse: { extractRouterFromHtml: () => ({}), ingestPayload: () => shareInfos } },
    DownloaderKit: { attachConfigHandler() {} }, importScripts() {},
    fetch: async () => ({ ok: true, async text() { return '<html>'; } })
  };
  vm.runInNewContext(source, context, { filename: 'background.js' });
  async function send(msg, from = sender) {
    return new Promise((resolve) => {
      listener(msg, from, resolve);
    });
  }
  return { send, calls, items, context, session,
    suggest(item) { return new Promise((resolve) => filenameListener(item, resolve)); },
    change(delta) { changedListener?.(delta); }
  };
}

{
  const worker = createWorker();
  const denied = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://v3.douyinvod.com/a.mp4'] }, { ...sender, url: 'http://www.douyin.com/video/1' });
  assert.equal(denied.ok, false);
  assert.equal(worker.context.self.DouyinDlBackground.validHttpsUrl('https://user:pass@v3.douyinvod.com/a.mp4', /douyinvod\.com$/), '');
  assert.equal(worker.context.self.DouyinDlBackground.safeFilename('..\\CON', '.mp4'), '.._CON.mp4');
  worker.items[8] = { id: 8, byExtensionId: 'another-extension', state: 'complete' };
  const foreign = await worker.send({ type: 'DOUYIN_DL_MEDIA_STATE', downloadId: 8 });
  assert.equal(foreign.ok, false);
  const foreignBlob = await worker.send({ type: 'DOUYIN_DL_SAVE_MEDIA', url: 'blob:https://evil.example/uuid', filename: 'bad' });
  assert.equal(foreignBlob.ok, false);
}

{
  const worker = createWorker({ failHosts: ['first.douyinvod.com'] });
  const result = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://www.douyin.com/play.mp4', 'https://first.douyinvod.com/a.mp4', 'https://second.douyinvod.com/b.mp4'], filename: '标题', saveAs: true });
  assert.equal(result.ok, true);
  assert.equal(worker.calls.download[0].url, 'https://first.douyinvod.com/a.mp4');
  assert.equal(worker.calls.download[1].url, 'https://second.douyinvod.com/b.mp4');
  assert.equal(worker.calls.download[1].saveAs, false);
  const state = await worker.send({ type: 'DOUYIN_DL_MEDIA_STATE', downloadId: result.downloadId });
  assert.deepEqual(Object.keys(state).sort(), ['bytesReceived', 'canResume', 'error', 'exists', 'filename', 'mime', 'ok', 'paused', 'state', 'totalBytes'].sort());
  await worker.send({ type: 'DOUYIN_DL_PAUSE_MEDIA', downloadId: result.downloadId });
  await worker.send({ type: 'DOUYIN_DL_RESUME_MEDIA', downloadId: result.downloadId });
  await worker.send({ type: 'DOUYIN_DL_SHOW_MEDIA', downloadId: result.downloadId });
  await worker.send({ type: 'DOUYIN_DL_CANCEL_MEDIA', downloadId: result.downloadId });
  assert.deepEqual(worker.calls.pause, [result.downloadId]);
  assert.deepEqual(worker.calls.resume, [result.downloadId]);
  assert.deepEqual(worker.calls.show, [result.downloadId]);
  assert.deepEqual(worker.calls.cancel, [result.downloadId]);
  const open = await worker.send({ type: 'DOUYIN_DL_OPEN_DOWNLOADS' });
  assert.equal(open.ok, true);
  assert.equal(worker.calls.tabs[0].url, 'chrome://downloads/');

  const blankOwner = createWorker({ blankExtensionId: true });
  const started = await blankOwner.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://v3.douyinvod.com/a.mp4'], filename: '标题' });
  const blankState = await blankOwner.send({ type: 'DOUYIN_DL_MEDIA_STATE', downloadId: started.downloadId });
  assert.equal(blankState.ok, true);

  const firefoxWorker = createWorker({ firefox: true });
  const firefoxOpen = await firefoxWorker.send({ type: 'DOUYIN_DL_OPEN_DOWNLOADS' });
  assert.equal(firefoxOpen.ok, true);
  assert.equal(firefoxWorker.calls.tabs[0].url, 'about:downloads');
}

{
  const worker = createWorker({ failHosts: ['only.douyinvod.com'] });
  const failed = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://only.douyinvod.com/a.mp4'] });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /network failed/);
  const cover = await worker.send({ type: 'DOUYIN_DL_DOWNLOAD_COVER', url: 'https://p3.douyinpic.com/cover.webp?x=1', filename: '封面.jpg' });
  assert.equal(cover.ok, true);
  assert.match(worker.calls.download.at(-1).filename, /\.webp$/);
}

{
  const worker = createWorker({ shareInfos: [{ id: '7653794808998426995' }, { id: '7653794808998426996', title: 'exact' }] });
  const exact = await worker.send({ type: 'DOUYIN_DL_FETCH_SHARE', awemeId: '7653794808998426996' });
  assert.equal(exact.info.title, 'exact');
  const missing = await worker.send({ type: 'DOUYIN_DL_FETCH_SHARE', awemeId: '7653794808998426997' });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /对应视频/);
}

{
  const worker = createWorker();
  const url = 'blob:https://www.douyin.com/random-uuid';
  const result = await worker.send({ type: 'DOUYIN_DL_SAVE_MEDIA', url, filename: '只有视频标题.mp4' });
  const suggestion = await worker.suggest({ id: result.downloadId, url, byExtensionId: 'extension-id', filename: 'random-uuid.mp4' });
  assert.equal(suggestion.filename, '只有视频标题.mp4');
  assert.equal(suggestion.conflictAction, 'uniquify');
  assert.equal(Object.keys(worker.session).length, 0);
  assert.equal(await worker.suggest({ id: 100, url, byExtensionId: 'other-extension' }), undefined);
}

{
  const worker = createWorker();
  const url = 'https://v3.douyinvod.com/hash.mp4';
  const results = await Promise.all(['第一个标题', '第二个标题'].map((filename) => worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: [url], filename })));
  // Even the same URL can have concurrent downloads with different templates.
  for (const index of [1, 0]) {
    const suggestion = await worker.suggest({ id: results[index].downloadId, url, byExtensionId: 'extension-id', filename: 'hash.mp4' });
    assert.equal(suggestion.filename, ['第一个标题.mp4', '第二个标题.mp4'][index]);
  }
  assert.equal(Object.keys(worker.session).length, 0);

  const session = {};
  const beforeRestart = createWorker({ session });
  const pending = await Promise.all(['重启任务甲', '重启任务乙'].map((filename) => beforeRestart.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: [url], filename })));
  const restarted = createWorker({ session });
  const suggestions = await Promise.all([1, 0].map((index) => restarted.suggest({ id: pending[index].downloadId, url, byExtensionId: 'extension-id' })));
  assert.equal(suggestions[0].filename, '重启任务乙.mp4');
  assert.equal(suggestions[1].filename, '重启任务甲.mp4');
  assert.equal(Object.keys(session).length, 0);
}

{
  const session = {};
  const worker = createWorker({ session });
  const url = 'https://v3.douyinvod.com/restart.mp4';
  const started = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: [url], filename: '后台重启仍保留标题' });
  const restarted = createWorker({ session });
  const suggestion = await restarted.suggest({ id: started.downloadId, url, byExtensionId: 'extension-id', filename: 'restart.mp4' });
  assert.equal(suggestion.filename, '后台重启仍保留标题.mp4');
  assert.equal(Object.keys(session).length, 0);
}

{
  const worker = createWorker({ determineBeforeCallback: true });
  await worker.send({ type: 'DOUYIN_DL_SAVE_MEDIA', url: 'blob:https://www.douyin.com/early', filename: '早于回调的命名.mp4' });
  const suggestion = await worker.calls.suggestions[0];
  assert.equal(suggestion.filename, '早于回调的命名.mp4');
  assert.equal(Object.keys(worker.session).length, 0);
}

{
  const worker = createWorker({ failHosts: ['fail.douyinvod.com'] });
  const failed = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://fail.douyinvod.com/a.mp4'], filename: '失败任务' });
  assert.equal(failed.ok, false);
  await new Promise(setImmediate);
  assert.equal(Object.keys(worker.session).length, 0);
  const started = await worker.send({ type: 'DOUYIN_DL_SAVE_DIRECT', urls: ['https://v3.douyinvod.com/b.mp4'], filename: '取消任务' });
  worker.change({ id: started.downloadId, state: { current: 'interrupted' } });
  await new Promise(setImmediate);
  assert.equal(Object.keys(worker.session).length, 0);
}

console.log('background tests passed');
