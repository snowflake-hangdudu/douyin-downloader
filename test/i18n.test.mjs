import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

function loadI18n(initial = {}) {
  const dom = new JSDOM('<main><button id="close" data-i18n="close">关闭</button><span class="dy-dl-video-title" data-i18n="close">用户视频标题</span><span id="status"></span></main>', { runScripts: 'outside-only' });
  const data = { ...initial };
  let changed;
  dom.window.chrome = {
    storage: {
      local: {
        get(key, callback) { callback({ [key]: data[key] }); },
        set(value, callback) { Object.assign(data, value); callback(); }
      },
      onChanged: { addListener(listener) { changed = listener; } }
    }
  };
  dom.window.eval(readFileSync(new URL('../shared/i18n.js', import.meta.url), 'utf8'));
  return { dom, data, changed: () => changed, i18n: dom.window.DownloaderKit.i18n };
}

test('i18n translates only explicit extension UI and keeps user metadata unchanged', async (t) => {
  const app = loadI18n();
  t.after(() => app.dom.window.close());
  await app.i18n.ready;
  await app.i18n.save('en');
  app.i18n.translateDom(app.dom.window.document.querySelector('main'));
  assert.equal(app.dom.window.document.querySelector('#close').textContent, 'Close');
  assert.equal(app.dom.window.document.querySelector('.dy-dl-video-title').textContent, '用户视频标题');
  assert.equal(app.i18n.translateText('当前页面：www.douyin.com'), 'Current page: www.douyin.com');
  assert.equal(app.i18n.translateText('开始下载'), 'Start download');
  assert.equal(app.i18n.translateText('MP4 视频'), 'MP4 video');
  assert.equal(app.i18n.translateText('下载已选 3 个'), 'Download selected (3)');
  assert.equal(app.i18n.translateText('预计大小：约 86 MB（约数，仅供参考）'), 'Estimated size: about 86 MB (estimate only)');
  assert.equal(app.i18n.translateText('列表下载完成：成功 2 个，失败 1 个'), 'List download complete: saved 2, failed 1');
  assert.equal(app.i18n.translateText('已加载 20 / 共 264 集 · 已选 5 个'), 'Loaded 20 / 264 episodes · Selected 5');
  assert.equal(app.i18n.translateText('正在下载 2/5：用户视频标题'), 'Downloading 2/5: 用户视频标题');
  assert.equal(app.i18n.translateText('预计大小：约 86 MB（约数，仅供参考） · 部分播放器可能只有声音'), 'Estimated size: about 86 MB (estimate only) · Some players may have audio only');
  assert.equal(app.i18n.translateText('第12集'), 'Episode 12');
});

test('i18n setText retains Chinese source and subscribers receive local and storage changes', async (t) => {
  const app = loadI18n();
  t.after(() => app.dom.window.close());
  await app.i18n.ready;
  const seen = [];
  app.i18n.onChange((value) => seen.push(value));
  const status = app.dom.window.document.querySelector('#status');
  await app.i18n.save('en');
  app.i18n.setText(status, '反馈邮箱：help@example.com');
  assert.equal(status.textContent, 'Feedback email: help@example.com');
  await app.i18n.save('zh-CN');
  app.i18n.translateDom(app.dom.window.document.querySelector('main'));
  assert.equal(status.textContent, '反馈邮箱：help@example.com');
  app.changed()({ [app.i18n.KEY]: { newValue: 'en' } }, 'local');
  assert.deepEqual(seen, ['en', 'zh-CN', 'en']);
});

test('i18n allows the marked empty-state message while preserving normal video metadata', async (t) => {
  const app = loadI18n();
  t.after(() => app.dom.window.close());
  await app.i18n.ready;
  await app.i18n.save('en');
  const title = app.dom.window.document.querySelector('.dy-dl-video-title');
  title.dataset.i18nUiMessage = '1';
  app.i18n.setText(title, '请打开单个视频页');
  assert.equal(title.textContent, 'Open a single video page');
  delete title.dataset.i18nUiMessage;
  app.i18n.setText(title, '用户视频标题');
  assert.equal(title.textContent, '用户视频标题');
});
