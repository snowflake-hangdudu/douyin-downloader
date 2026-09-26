import assert from 'node:assert/strict';
import test from 'node:test';
import Filename from '../lib/filename.js';
import Settings from '../lib/download-settings.js';

test('filename templates render Douyin metadata and sanitize Windows paths', () => {
  const name = Filename.renderTemplate('{title} - {author} - {id} - {quality}', {
    title: '  题目:/测试  ', author: '作者*甲', id: '7653794808998426996'
  }, { qualityLabel: '1080P' });
  assert.equal(name, '题目__测试 - 作者_甲 - 7653794808998426996 - 1080P');
  assert.equal(Filename.withExtension(name, 'mp4').endsWith('.mp4'), true);
});

test('filename templates can include zero-padded collection episode and date', () => {
  assert.equal(Filename.renderTemplate('{title} - 第{episode}集 - {date}', {
    title: '合集标题', id: '12345'
  }, { episode: 3, date: '2026-09-27' }), '合集标题 - 第03集 - 2026-09-27');
});

test('invalid or path-bearing filename templates are rejected', () => {
  assert.equal(Filename.validateTemplate('../{title}').ok, false);
  assert.equal(Filename.validateTemplate('{unknown}').ok, false);
  assert.equal(Filename.validateTemplate('   ').ok, false);
});

test('download settings are namespaced, persisted, and reject invalid updates', async () => {
  const data = {};
  const store = Settings.create({
    async get(keys) { return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])); },
    async set(values) { Object.assign(data, values); }
  });
  const defaults = await store.loadSettings();
  assert.equal(defaults.filenameTemplate, '{title}');
  assert.equal(data.douyinDlSettings_v1.filenameTemplate, '{title}');
  await assert.rejects(store.saveSettings({ filenameTemplate: '{bad}' }), /未知变量/);
  assert.equal(data.douyinDlSettings_v1.filenameTemplate, '{title}');
  const saved = await store.saveSettings({ filenameTemplate: '{title} - {id}' });
  assert.equal(saved.filenameTemplate, '{title} - {id}');
});
