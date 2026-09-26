import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const packSource = readFileSync(new URL('../scripts/pack.py', import.meta.url), 'utf8');
const flagSource = readFileSync(new URL('../shared/debug-flag.js', import.meta.url), 'utf8');
const debugSource = readFileSync(new URL('../shared/debug.js', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('../shared/panel.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../shared/panel.css', import.meta.url), 'utf8');

test('pack script flips @pack:debug to false without rewriting source tree', () => {
  assert.match(flagSource, /DownloaderKit\.DEBUG\s*=\s*false;\s*\/\/\s*@pack:debug/);
  assert.match(packSource, /@pack:debug/);
  assert.match(packSource, /\\1false\\2/);
});

test('isEnabled is true only when DEBUG === true', () => {
  const context = vm.createContext({ globalThis: {} });
  context.globalThis = context;
  vm.runInContext(debugSource, context);
  const debug = context.DownloaderKit.debug;
  context.DownloaderKit.DEBUG = true;
  assert.equal(debug.isEnabled(), true);
  context.DownloaderKit.DEBUG = false;
  assert.equal(debug.isEnabled(), false);
  delete context.DownloaderKit.DEBUG;
  assert.equal(debug.isEnabled(), false);
  assert.equal(debug.create({ enabled: false }).enabled, false);
});

test('panel only builds debug block when showDebug is on and css hides leftovers', () => {
  assert.match(panelSource, /dataset\.debug\s*=\s*opts\.showDebug\s*\?\s*'1'\s*:\s*'0'/);
  assert.match(panelSource, /if\s*\(\s*opts\.showDebug\s*\)\s*\{/);
  assert.match(cssSource, /\.dl-kit\[data-debug="0"\]\s*\.dl-kit-debug/);
});
