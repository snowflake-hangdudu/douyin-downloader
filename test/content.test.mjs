import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const first = { id: '7653794808998426996', title: '第一个视频', author: '作者甲', duration: 119000, cover: 'https://p3.douyinpic.com/cover.webp', qualities: [{ qn: 1080, label: '1080P', size: 100, urls: ['https://v3.douyinvod.com/a.mp4'] }] };
const second = { ...first, id: '7653794808998426997', title: '第二个视频', author: '作者乙' };
const third = { ...first, id: '7653794808998426998', title: '第三个视频', author: '作者丙' };
const completed = { ok: true, state: 'complete', bytesReceived: 100, totalBytes: 100, exists: true, mime: 'video/mp4', filename: 'saved.mp4' };
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function catalog(...items) {
  const map = new Map(items.map((item) => [item.id, item]));
  return (id) => map.get(id) || items[0];
}

async function mount(t, options = {}) {
  const startId = options.info?.id || first.id;
  const byId = options.byId || catalog(options.info || first, second, third);
  const dom = new JSDOM('<div id="home"></div>', { url: 'https://www.douyin.com/video/' + startId, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window;
  const calls = [];
  const storage = { ...(options.storage || {}) };
  w.chrome = { storage: { local: {
    async get() { return { ...storage }; },
    async set(value) { Object.assign(storage, value); }
  } } };
  const copied = [];
  const pending = [];
  const pendingMix = [];
  const agentCalls = [];
  const listeners = new WeakMap();
  const panelRoot = w.document.createElement('div');
  let shellOptions;
  let shellInstance;
  let objectUrlSeq = 0;
  w.URL.createObjectURL = (blob) => {
    objectUrlSeq += 1;
    return 'blob:https://www.douyin.com/' + objectUrlSeq + '-' + (blob?.size || 0);
  };
  w.URL.revokeObjectURL = () => {};
  const add = w.EventTarget.prototype.addEventListener;
  w.EventTarget.prototype.addEventListener = function (type, handler, ...args) {
    if (type === 'click' || type === 'change' || type === 'input') listeners.set(this, handler);
    return add.call(this, type, handler, ...args);
  };
  const post = (data) => w.dispatchEvent(new w.MessageEvent('message', { source: w, data }));
  const replyMix = (req, payload) => {
    post({
      source: 'douyin-dl-agent',
      id: req.id,
      type: 'OK',
      data: {
        mixId: payload.mixId || req.mixId,
        title: payload.title || '测试合集',
        meta: payload.meta || null,
        items: payload.items || [],
        cursor: payload.cursor || 0,
        hasMore: payload.hasMore === true,
        hint: (payload.items || []).length ? '勾选合集视频后将依次下载。' : '请打开合集标签'
      }
    });
  };
  w.postMessage = (data) => {
    if (data.source !== 'douyin-dl-panel') return;
    agentCalls.push(data);
    if (data.type === 'RESOLVE_VIDEO') {
      const matched = String(data.href || '').match(/\/video\/(\d{5,})/);
      const info = matched ? byId(matched[1]) : (options.info || first);
      if (options.failResolveIds?.has(info.id)) {
        queueMicrotask(() => post({ source: 'douyin-dl-agent', id: data.id, type: 'ERR', error: '未识别到视频信息，请先播放当前视频或刷新页面' }));
        return;
      }
      const resolveCount = agentCalls.filter((item) => item.type === 'RESOLVE_VIDEO').length;
      const shouldDefer = options.deferResolve
        || (options.deferResolveIds?.has(info.id) && resolveCount > 1);
      if (shouldDefer) {
        pending.push({ data, info });
        return;
      }
      queueMicrotask(() => post({ source: 'douyin-dl-agent', id: data.id, type: 'OK', data: { info } }));
    } else if (data.type === 'RESOLVE_MIX' || data.type === 'LOAD_MIX_MORE') {
      if (options.deferMix && data.type === 'RESOLVE_MIX') {
        pendingMix.push(data);
        return;
      }
      const items = typeof options.mixItems === 'function'
        ? options.mixItems(data.mixId)
        : (options.mixItems || []);
      const title = typeof options.mixTitle === 'function'
        ? options.mixTitle(data.mixId)
        : (options.mixTitle || '测试合集');
      const meta = typeof options.mixMeta === 'function'
        ? options.mixMeta(data.mixId)
        : options.mixMeta;
      queueMicrotask(() => replyMix(data, {
        mixId: data.mixId,
        title,
        items,
        meta,
        hasMore: Boolean(options.mixHasMore)
      }));
    } else if (data.type === 'START_DOWNLOAD') {
      if (options.onStartDownload) {
        const handled = options.onStartDownload(data, post);
        if (handled !== false) return;
      }
      const matched = String(data.href || '').match(/\/video\/(\d{5,})/);
      const info = matched ? byId(matched[1]) : first;
      if (options.failIds?.has(info.id)) {
        queueMicrotask(() => post({ source: 'douyin-dl-agent', id: data.id, type: 'ERR', error: '模拟失败' }));
        return;
      }
      const blob = new w.Blob([new Uint8Array(64)], { type: 'video/mp4' });
      queueMicrotask(() => post({
        source: 'douyin-dl-agent',
        id: data.id,
        type: 'OK',
        data: { blob, filename: (info.title || '视频') + '.mp4', info, quality: info.qualities?.[0], jobId: data.jobId }
      }));
    } else if (data.type === 'CANCEL_DOWNLOAD') {
      if (data.id) queueMicrotask(() => post({ source: 'douyin-dl-agent', id: data.id, type: 'OK', data: {} }));
    } else if (data.id) {
      queueMicrotask(() => post({ source: 'douyin-dl-agent', id: data.id, type: 'OK', data: {} }));
    }
  };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (value) => copied.push(value) } });
  w.DownloaderKit = {
    runtime: {
      getApi: () => ({
        storage: {
          local: {
            get: (key, callback) => callback(storage),
            set: (value, callback) => { Object.assign(storage, value); callback(); }
          }
        },
        runtime: {
          onMessage: { addListener() {} },
          getURL: (path) => 'chrome-extension://test/' + path,
          sendMessage: async (message) => {
            calls.push(message);
            if (options.send) {
              const value = await options.send(message);
              if (value) return value;
            }
            if (/SAVE_MEDIA|SAVE_DIRECT|DOWNLOAD_COVER/.test(message.type)) return { ok: true, downloadId: 42 };
            return completed;
          }
        }
      })
    },
    shell: { mount: (value) => {
      shellOptions = value;
      shellInstance = {
        home: w.document.getElementById('home'),
        panel: { root: panelRoot },
        debug: { log() {} },
        noteSuccess() {},
        openSheet(key) {
          if (key !== 'settings') return;
          const body = w.document.createElement('div');
          shellOptions.onFillSettings(body, key, { title: '设置' });
          w.document.body.appendChild(body);
        }
      };
      return shellInstance;
    } }
  };
  for (const file of ['shared/i18n.js', 'lib/aweme-parse.js', 'lib/download-client.js', 'lib/filename.js', 'lib/download-settings.js', 'content/content.js']) {
    w.eval(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
  }
  await tick();
  return {
    w,
    calls,
    agentCalls,
    storage,
    panelRoot,
    copied,
    pending,
    pendingMix,
    post,
    replyMix,
    click(selector) {
      const node = w.document.querySelector(selector);
      if (!node || node.disabled) return;
      const listener = listeners.get(node);
      if (listener) listener.call(node, { isTrusted: true });
      else if (typeof node.onclick === 'function') node.onclick({ isTrusted: true });
      else throw new Error('no click handler for ' + selector);
    },
    change(selector, value) {
      const node = w.document.querySelector(selector);
      if (!node) throw new Error('missing node for ' + selector);
      node.value = value;
      const listener = listeners.get(node);
      if (listener) listener.call(node, { isTrusted: true, type: 'change', target: node });
      else node.dispatchEvent(new w.Event('change', { bubbles: true }));
    },
    el: (selector) => w.document.querySelector(selector),
    openSettings() { shellInstance.openSheet('settings'); },
    navigate(info) {
      w.history.replaceState({}, '', '/video/' + info.id);
      post({ source: 'douyin-dl-agent', type: 'LOCATION', href: w.location.href });
    }
  };
}

test('mounts current work without filename, save path or copy tools', async (t) => {
  const app = await mount(t);
  assert.equal(app.el('.dy-dl-video-title').textContent, first.title);
  assert.equal(app.el('.dy-dl-start').disabled, false);
  assert.equal(app.el('.dy-dl-quality-pills .dy-dl-pill.active').textContent, '1080P');
  assert.equal(app.el('.dy-dl-mode-tabs').classList.contains('hidden'), true);
  assert.equal(app.el('.dy-dl-filename-style'), null);
  assert.equal(app.el('.dy-dl-save-as'), null);
  assert.equal(app.el('[data-action="refresh"]'), null);
  assert.equal(app.el('[data-action="copy-text"]'), null);
  assert.equal(app.el('[data-action="copy-link"]'), null);
});

test('quality choices keep every available tier above 360p and prefer the highest H264 tier', async (t) => {
  const qualities = [
    { qn: 2160, label: '2160P', h265: true, urls: ['https://v3.douyinvod.com/2160.mp4'] },
    { qn: 1440, label: '1440P', h265: false, urls: ['https://v3.douyinvod.com/1440.mp4'] },
    { qn: 1080, label: '1080P', h265: false, urls: ['https://v3.douyinvod.com/1080.mp4'] },
    { qn: 720, label: '720P', h265: false, urls: ['https://v3.douyinvod.com/720.mp4'] },
    { qn: 540, label: '540P', h265: false, urls: ['https://v3.douyinvod.com/540.mp4'] },
    { qn: 360, label: '360P', h265: false, urls: ['https://v3.douyinvod.com/360.mp4'] }
  ];
  const app = await mount(t, { info: { ...first, qualities } });
  assert.deepEqual([...app.el('.dy-dl-quality-pills').querySelectorAll('.dy-dl-pill')].map((item) => item.textContent), [
    '2160P', '1440P', '1080P', '720P', '540P'
  ]);
  assert.equal(app.el('.dy-dl-quality-pills .active').textContent, '1440P');
  app.click('.dy-dl-quality-pills .dy-dl-pill');
  assert.equal(app.el('.dy-dl-quality-pills .active').textContent, '2160P');
  assert.doesNotMatch(app.panelRoot.textContent, /h265/i);
});

test('quality choices retain low resolution as a fallback when no tier exceeds 360p', async (t) => {
  const qualities = [
    { qn: 360, label: '360P', h265: false, urls: ['https://v3.douyinvod.com/360.mp4'] },
    { qn: 270, label: '270P', h265: false, urls: ['https://v3.douyinvod.com/270.mp4'] }
  ];
  const app = await mount(t, { info: { ...first, qualities } });
  assert.deepEqual([...app.el('.dy-dl-quality-pills').querySelectorAll('.dy-dl-pill')].map((item) => item.textContent), ['360P', '270P']);
  assert.equal(app.el('.dy-dl-quality-pills .active').textContent, '360P');
});

test('settings persist the theme and filename template used by downloads', async (t) => {
  const app = await mount(t, { storage: {
    douyinDlTheme_v1: 'tokyo-love',
    douyinDlSettings_v1: { version: 1, filenameTemplate: '{title} - {id} - {quality}' }
  } });
  assert.equal(app.panelRoot.dataset.theme, 'tokyo-love');
  app.click('.dy-dl-start');
  await wait(30);
  const request = app.calls.find((item) => item.type.endsWith('SAVE_MEDIA'));
  assert.equal(request.filename, '第一个视频 - 7653794808998426996 - 1080P.mp4');
});

test('filename settings apply to collection episodes and cover downloads', async (t) => {
  const mix = { id: '7512345678901234560', name: '文件名合集', episode: 3, updatedTo: 3, playCount: 0, cover: '' };
  const episode = { ...first, mix, episode: 3 };
  const app = await mount(t, {
    info: episode,
    mixItems: [episode],
    mixMeta: mix,
    byId: catalog(episode),
    storage: { douyinDlSettings_v1: { version: 1, filenameTemplate: '{title} - 第{episode}集 - {quality}' } }
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  app.click('.dy-dl-list-select-all');
  app.click('.dy-dl-list-start');
  await wait(30);
  const listDownload = app.calls.find((item) => item.type.endsWith('SAVE_MEDIA'));
  assert.equal(listDownload.filename, '第一个视频 - 第03集 - 1080P.mp4');

  const coverApp = await mount(t, {
    storage: { douyinDlSettings_v1: { version: 1, filenameTemplate: '{title} - {quality}' } }
  });
  coverApp.click('.dy-dl-cover-download');
  await tick();
  const coverDownload = coverApp.calls.find((item) => item.type.endsWith('DOWNLOAD_COVER'));
  assert.equal(coverDownload.filename, '第一个视频 - 封面');
});

test('settings sheet saves filename templates and exposes the supplied theme choices', async (t) => {
  const app = await mount(t);
  app.openSettings();
  await wait(50);
  assert.equal(app.el('.dy-dl-settings-theme-current-label').textContent, '默认');
  assert.deepEqual([...app.w.document.querySelectorAll('.dy-dl-settings-theme-option')].map((item) => item.dataset.themeOption), [
    'douyin', 'tokyo-love', 'manchester-sea', 'chinese-odyssey'
  ]);
  app.change('.dy-dl-settings-select[aria-label="文件名规则"]', 'detailed');
  await wait(320);
  assert.equal(app.storage.douyinDlSettings_v1.filenameTemplate, '{title} - {author} - {id} - {quality}');
  assert.match(app.el('.dy-dl-settings-preview').textContent, /示例视频标题 - 示例作者 - 7653794808998426996 - 1080P\.mp4/);
});

test('notice sheet includes development cooperation section instead of a separate footer link', () => {
  const panelJs = readFileSync(new URL('../shared/panel.js', import.meta.url), 'utf8');
  const noticeJs = readFileSync(new URL('../shared/notice.js', import.meta.url), 'utf8');
  const shellJs = readFileSync(new URL('../shared/shell.js', import.meta.url), 'utf8');
  assert.doesNotMatch(panelJs, /dataset\.sheet = 'coop'/);
  assert.doesNotMatch(panelJs, /footerAction\('coop'/);
  assert.match(noticeJs, /appendCoopSection/);
  assert.match(shellJs, /coop: remoteContent\.coop/);
  assert.match(shellJs, /if \(key === 'coop'\) key = 'notice'/);
});

test('mix list shows total episodes and load-more when incomplete', async (t) => {
  const mix = { id: '7512345678901234560', name: '东爱全集解说', episode: 3, updatedTo: 31, playCount: 0, cover: '' };
  const video = { ...first, mix, episode: 3 };
  const mixItems = Array.from({ length: 5 }, (_, index) => ({
    ...first,
    id: String(7653794808998426900 + index),
    title: `第${index + 1}集`,
    mix,
    episode: index + 1,
    qualities: first.qualities
  }));
  const app = await mount(t, {
    info: video,
    mixItems,
    mixMeta: mix,
    mixHasMore: true,
    byId: catalog(video, ...mixItems)
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  assert.match(app.el('.dy-dl-list-count').textContent, /共 31 集/);
  assert.equal(app.el('.dy-dl-list-load-more').classList.contains('hidden'), false);
});

test('mix videos expose list download tab matching bilibili mode tabs', async (t) => {
  const mixed = {
    ...first,
    mix: { id: '7512345678901234560', name: '测试合集', episode: 2, updatedTo: 6, playCount: 0, cover: '' }
  };
  const mixItems = [
    mixed,
    { ...second, mix: mixed.mix, episode: 3, qualities: first.qualities }
  ];
  const app = await mount(t, { info: mixed, mixItems, byId: catalog(mixed, ...mixItems) });
  assert.equal(app.el('.dy-dl-mode-tabs').classList.contains('hidden'), false);
  assert.equal(app.el('.dy-dl-mode-tabs [data-mode="list"]').textContent, '列表下载');
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  assert.equal(app.el('.dy-dl-list-body').classList.contains('hidden'), false);
  assert.equal(app.el('.dy-dl-list-title').textContent, '测试合集');
  assert.equal(app.el('.dy-dl-list-items').querySelectorAll('.dy-dl-list-item').length, 2);
  app.click('.dy-dl-list-select-all');
  await tick();
  assert.equal(app.el('.dy-dl-list-start').disabled, false);
});

test('stale mix response cannot overwrite the current collection list', async (t) => {
  const mixA = { id: '7512345678901234560', name: '合集A', episode: 1, updatedTo: 2, playCount: 0, cover: '' };
  const mixB = { id: '7512345678901234561', name: '合集B', episode: 1, updatedTo: 1, playCount: 0, cover: '' };
  const videoA = { ...first, mix: mixA };
  const videoB = { ...second, mix: mixB };
  const itemsA = [
    { ...videoA, title: 'A第一集' },
    { ...videoA, id: '7653794808998426901', title: 'A第二集', episode: 2 }
  ];
  const itemsB = [{ ...videoB, title: 'B唯一集' }];
  const app = await mount(t, {
    info: videoA,
    deferMix: true,
    byId: catalog(videoA, videoB),
    mixItems: (mixId) => (mixId === mixB.id ? itemsB : itemsA),
    mixTitle: (mixId) => (mixId === mixB.id ? '合集B' : '合集A')
  });

  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  assert.equal(app.pendingMix.length, 1);
  assert.equal(app.pendingMix[0].mixId, mixA.id);

  app.navigate(videoB);
  await tick();
  await tick();
  assert.equal(app.el('.dy-dl-video-title').textContent, videoB.title);
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  assert.equal(app.pendingMix.length, 2);
  assert.equal(app.pendingMix[1].mixId, mixB.id);

  app.replyMix(app.pendingMix[0], { mixId: mixA.id, title: '合集A', items: itemsA });
  await tick();
  assert.notEqual(app.el('.dy-dl-list-title').textContent, '合集A');

  app.replyMix(app.pendingMix[1], { mixId: mixB.id, title: '合集B', items: itemsB });
  await tick();
  assert.equal(app.el('.dy-dl-list-title').textContent, '合集B');
  assert.equal(app.el('.dy-dl-list-items').querySelectorAll('.dy-dl-list-item').length, 1);
  assert.match(app.el('.dy-dl-list-items').textContent, /B唯一集/);
});

test('list queue downloads three episodes and reports a single failure without marking cancel complete', async (t) => {
  const mix = { id: '7512345678901234560', name: '三集合集', episode: 1, updatedTo: 3, playCount: 0, cover: '' };
  const ep1 = { ...first, mix, episode: 1 };
  const ep2 = { ...second, mix, episode: 2 };
  const ep3 = { ...third, mix, episode: 3 };
  const app = await mount(t, {
    info: ep1,
    mixItems: [ep1, ep2, ep3],
    byId: catalog(ep1, ep2, ep3),
    failIds: new Set([ep2.id])
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  app.click('.dy-dl-list-select-all');
  app.click('.dy-dl-list-start');
  await wait(40);
  assert.match(app.el('.dy-dl-list-status').textContent, /成功 2 个，失败 1 个/);
  assert.equal((app.storage.douyinDlHistory_v1 || []).length, 2);
  assert.equal(app.el('.dy-dl-list-cancel').classList.contains('hidden'), true);
  assert.equal(app.el('.dy-dl-list-start').disabled, false);
});

test('cancel queue while resolving does not start later downloads', async (t) => {
  const mix = { id: '7512345678901234560', name: '待识别合集', episode: 1, updatedTo: 2, playCount: 0, cover: '' };
  const bare1 = { id: first.id, title: '待识别一', author: '甲', duration: 1000, cover: first.cover, mix, episode: 1 };
  const bare2 = { id: second.id, title: '待识别二', author: '乙', duration: 1000, cover: first.cover, mix, episode: 2 };
  const resolved1 = { ...bare1, qualities: first.qualities };
  const resolved2 = { ...bare2, qualities: first.qualities };
  const app = await mount(t, {
    info: resolved1,
    mixItems: [bare1, bare2],
    byId: catalog(resolved1, resolved2),
    deferResolveIds: new Set([bare1.id, bare2.id])
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  app.click('.dy-dl-list-select-all');
  app.click('.dy-dl-list-start');
  await tick();
  assert.ok(app.pending.some((item) => item.info.id === bare1.id));
  app.click('.dy-dl-list-cancel');
  await tick();
  const firstPending = app.pending.find((item) => item.info.id === bare1.id);
  app.post({ source: 'douyin-dl-agent', id: firstPending.data.id, type: 'OK', data: { info: resolved1 } });
  await wait(30);
  assert.match(app.el('.dy-dl-list-status').textContent, /已取消/);
  assert.match(app.el('.dy-dl-list-status').textContent, /未执行/);
  assert.equal(app.agentCalls.filter((item) => item.type === 'START_DOWNLOAD').length, 0);
  assert.equal(app.calls.filter((item) => /SAVE_MEDIA|SAVE_DIRECT/.test(item.type || '')).length, 0);
  assert.equal(app.storage.douyinDlHistory_v1, undefined);
});

test('cancel after an episode already finished still counts it as saved', async (t) => {
  const mix = { id: '7512345678901234560', name: '并发取消合集', episode: 1, updatedTo: 2, playCount: 0, cover: '' };
  const ep1 = { ...first, mix, episode: 1 };
  const ep2 = { ...second, mix, episode: 2 };
  let finishFirst;
  let started = 0;
  const app = await mount(t, {
    info: ep1,
    mixItems: [ep1, ep2],
    byId: catalog(ep1, ep2),
    onStartDownload(data, post) {
      started += 1;
      const matched = String(data.href || '').match(/\/video\/(\d{5,})/);
      const info = matched?.[1] === ep2.id ? ep2 : ep1;
      const blob = new Blob([new Uint8Array(64)], { type: 'video/mp4' });
      queueMicrotask(() => post({
        source: 'douyin-dl-agent',
        id: data.id,
        type: 'OK',
        data: { blob, filename: info.title + '.mp4', info, quality: info.qualities[0], jobId: data.jobId }
      }));
      return true;
    },
    send: (message) => {
      if (message.type.endsWith('MEDIA_STATE')) {
        if (!finishFirst) {
          return new Promise((resolve) => { finishFirst = resolve; });
        }
        return completed;
      }
      return null;
    }
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  app.click('.dy-dl-list-select-all');
  app.click('.dy-dl-list-start');
  await wait(20);
  assert.equal(started, 1);
  assert.ok(finishFirst);
  app.click('.dy-dl-list-cancel');
  finishFirst(completed);
  await wait(40);
  assert.match(app.el('.dy-dl-list-status').textContent, /已取消/);
  assert.match(app.el('.dy-dl-list-status').textContent, /已保存 1 个/);
  assert.equal((app.storage.douyinDlHistory_v1 || []).length, 1);
  assert.equal(app.storage.douyinDlHistory_v1[0].id, ep1.id);
  assert.ok(started < 3);
});

test('single job cancel skips only that episode and continues the queue', async (t) => {
  const mix = { id: '7512345678901234560', name: '单集取消合集', episode: 1, updatedTo: 3, playCount: 0, cover: '' };
  const ep1 = { ...first, mix, episode: 1 };
  const ep2 = { ...second, mix, episode: 2 };
  const ep3 = { ...third, mix, episode: 3 };
  let cancelFirst = null;
  const app = await mount(t, {
    info: ep1,
    mixItems: [ep1, ep2, ep3],
    byId: catalog(ep1, ep2, ep3),
    onStartDownload(data, post) {
      const matched = String(data.href || '').match(/\/video\/(\d{5,})/);
      const info = matched ? catalog(ep1, ep2, ep3)(matched[1]) : ep1;
      if (info.id === ep1.id) {
        cancelFirst = () => {
          const cardCancel = app.el('.dy-dl-list-job-list .dy-dl-job-cancel');
          assert.ok(cardCancel);
          app.click('.dy-dl-list-job-list .dy-dl-job-cancel');
          post({ source: 'douyin-dl-agent', id: data.id, type: 'ERR', error: '下载已取消' });
        };
        queueMicrotask(() => cancelFirst());
        return true;
      }
      const blob = new Blob([new Uint8Array(64)], { type: 'video/mp4' });
      queueMicrotask(() => post({
        source: 'douyin-dl-agent',
        id: data.id,
        type: 'OK',
        data: { blob, filename: info.title + '.mp4', info, quality: info.qualities[0], jobId: data.jobId }
      }));
      return true;
    }
  });
  app.click('.dy-dl-mode-tabs [data-mode="list"]');
  await tick();
  await tick();
  app.click('.dy-dl-list-select-all');
  app.click('.dy-dl-list-start');
  await wait(60);
  assert.match(app.el('.dy-dl-list-status').textContent, /成功 2 个，失败 1 个/);
  assert.doesNotMatch(app.el('.dy-dl-list-status').textContent, /已取消/);
  assert.equal((app.storage.douyinDlHistory_v1 || []).length, 2);
  assert.equal(app.el('.dy-dl-list-cancel').classList.contains('hidden'), true);
});

test('switching videos during download never corrupts filename or history', async (t) => {
  let finish;
  const app = await mount(t, { send: (message) => message.type.endsWith('MEDIA_STATE') ? new Promise((resolve) => { finish = resolve; }) : null });
  app.click('.dy-dl-start'); await tick();
  const started = app.calls.find((m) => m.type.endsWith('SAVE_MEDIA'));
  assert.match(started.filename, /第一个视频/);
  assert.match(String(started.url || ''), /^blob:/);
  assert.equal(app.storage.douyinDlHistory_v1, undefined);
  app.navigate(second); await tick();
  assert.equal(app.el('.dy-dl-video-title').textContent, second.title);
  assert.equal(app.el('.dy-dl-start').disabled, false);
  assert.equal(app.el('.dy-dl-start-label').textContent, '再下一个 (1)');
  finish(completed); await tick();
  assert.equal(app.storage.douyinDlHistory_v1[0].id, first.id);
  assert.match(app.storage.douyinDlHistory_v1[0].href, new RegExp(first.id));
  assert.equal(app.el('.dy-dl-start').disabled, false);
  assert.equal(app.el('.dy-dl-status').classList.contains('hidden'), true);
});

test('a browser interruption does not add successful history', async (t) => {
  const app = await mount(t, { send: (message) => message.type.endsWith('MEDIA_STATE') ? { ok: true, state: 'interrupted', error: 'FILE_NO_SPACE' } : null });
  app.click('.dy-dl-start'); await tick();
  assert.equal(app.storage.douyinDlHistory_v1, undefined);
  assert.match(app.el('.dy-dl-status').textContent, /FILE_NO_SPACE/);
  assert.equal(app.el('.dy-dl-start').disabled, false);
});

test('page scripts cannot trigger a privileged download using synthetic clicks', async (t) => {
  const app = await mount(t);
  app.el('.dy-dl-start').click(); app.el('.dy-dl-cover-download').click(); await tick();
  assert.equal(app.calls.some((m) => /SAVE_MEDIA|SAVE_DIRECT|DOWNLOAD_COVER/.test(m.type)), false);
});

test('stale resolution after navigation cannot replace current work', async (t) => {
  const app = await mount(t, { deferResolve: true });
  app.navigate(second); await tick();
  const reply = ({ data, info }) => app.post({ source: 'douyin-dl-agent', id: data.id, type: 'OK', data: { info } });
  reply(app.pending[1]); await tick(); reply(app.pending[0]); await tick();
  assert.equal(app.el('.dy-dl-video-title').textContent, second.title);
});

test('cover reports saved only when browser completes and does not double-submit', async (t) => {
  let finish;
  const app = await mount(t, { send: (message) => message.type.endsWith('MEDIA_STATE') ? new Promise((resolve) => { finish = resolve; }) : null });
  app.click('.dy-dl-cover-download'); app.click('.dy-dl-cover-download'); await tick();
  assert.equal(app.calls.filter((m) => m.type.endsWith('DOWNLOAD_COVER')).length, 1);
  assert.equal(app.el('.dy-dl-status').classList.contains('hidden'), true);
  finish({ ...completed, mime: 'image/webp' }); await tick();
  assert.equal(app.el('.dy-dl-status').classList.contains('hidden'), true);
  assert.equal(app.el('.dy-dl-cover-download').disabled, false);
});


test('failed recognition clears old filename and recovers when the current source arrives', async (t) => {
  const app = await mount(t, { failResolveIds: new Set([second.id]) });
  assert.match(app.el('.dy-dl-filename-preview').textContent, /第一个视频/);
  app.navigate(second);
  await wait(25);
  assert.equal(app.el('.dy-dl-start').disabled, true);
  assert.doesNotMatch(app.el('.dy-dl-filename-preview').textContent, /第一个视频/);
  assert.equal(app.el('.dy-dl-retry-info').classList.contains('hidden'), false);
  app.post({ source: 'douyin-dl-agent', type: 'VIDEO_AVAILABLE', data: { info: first } });
  assert.equal(app.el('.dy-dl-start').disabled, true);
  app.post({ source: 'douyin-dl-agent', type: 'VIDEO_AVAILABLE', data: { info: second } });
  assert.equal(app.el('.dy-dl-video-title').textContent, second.title);
  assert.equal(app.el('.dy-dl-start').disabled, false);
  assert.match(app.el('.dy-dl-filename-preview').textContent, /第二个视频/);
});

test('English covers the download panel and changing language preserves video metadata', async (t) => {
  const app = await mount(t, { storage: { 'douyin-dl-language-v1': 'en' } });
  await tick();
  assert.equal(app.el('.dy-dl-start-label').textContent, 'Start download');
  assert.equal(app.el('.dy-dl-format-label').textContent, 'Format');
  assert.equal(app.el('.dy-dl-cover-download').textContent, 'Download cover');
  assert.equal(app.el('.dy-dl-video-title').textContent, first.title);
  await app.w.DownloaderKit.i18n.save('zh-CN');
  assert.equal(app.el('.dy-dl-start-label').textContent, '开始下载');
  assert.equal(app.el('.dy-dl-cover-download').textContent, '下载封面');
  assert.equal(app.el('.dy-dl-video-title').textContent, first.title);
});
