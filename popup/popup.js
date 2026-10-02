const EXT = typeof browser !== 'undefined' ? browser : chrome;
const VERSION = EXT.runtime.getManifest().version;
const CONFIG = globalThis.DOWNLOADER_POPUP_CONFIG || {};
const THEME_KEY = 'douyinDlTheme_v1';
const THEMES = new Set(['douyin', 'tokyo-love', 'manchester-sea', 'chinese-odyssey']);
const $ = (id) => document.getElementById(id);
const I18N = globalThis.DownloaderKit?.i18n;
const tr = (key, values) => I18N?.t?.(key, values) || key;
const translate = (text) => I18N?.translateText?.(text) || text;
let latestInfo = null;

$('app-version').textContent = 'v' + VERSION;
if (CONFIG.title) $('app-title').textContent = translate(CONFIG.title);

function formatCurrentSite(url) {
  if (!url) return tr('currentPageEmpty');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return tr('currentPage', { value: parsed.protocol.replace(':', '') });
    }
    let path = parsed.pathname;
    if (path.length > 24) path = path.slice(0, 24) + '…';
    return tr('currentPage', { value: parsed.hostname + (path && path !== '/' ? path : '') });
  } catch (_) {
    return tr('currentPageUnknown');
  }
}

function showState(name) {
  ['state-loading', 'state-ready', 'state-empty', 'state-error'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== name);
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || '超时')), ms))
  ]);
}

function fillList(parent, items, className) {
  parent.replaceChildren();
  (items || []).forEach((text) => {
    const node = document.createElement(className === 'popup-step' ? 'div' : (parent.tagName === 'UL' ? 'li' : 'span'));
    if (className === 'popup-step') {
      node.className = 'popup-step';
      const num = document.createElement('span');
      num.className = 'popup-step-num';
      num.textContent = String(parent.children.length + 1);
      const label = document.createElement('span');
      label.className = 'popup-step-text';
      label.textContent = translate(text);
      node.append(num, label);
    } else {
      node.className = className || '';
      node.textContent = translate(text);
    }
    parent.appendChild(node);
  });
}

function applyEmptyCopy() {
  const empty = CONFIG.empty || {};
  if (empty.detect) $('empty-detect').textContent = translate(empty.detect);
  if (empty.title) $('empty-title').textContent = translate(empty.title);
  if (empty.lead) $('empty-lead').textContent = translate(empty.lead);
  fillList($('empty-steps'), empty.steps || [
    '打开对应网站的内容页，按 F5 刷新',
    '点击页面右下角图标打开面板',
    '在面板里完成保存'
  ], 'popup-step');
  const note = $('empty-note');
  if (note && empty.note) note.textContent = translate(empty.note);
  if (CONFIG.faqUrl) $('popup-faq').href = CONFIG.faqUrl;
  if (CONFIG.privacyUrl) $('popup-privacy').href = CONFIG.privacyUrl;
  const go = $('btn-go-site');
  if (empty.homeUrl) {
    go.href = empty.homeUrl;
    go.textContent = translate(empty.homeLabel || '打开网站');
    go.classList.remove('hidden');
  } else {
    go.classList.add('hidden');
  }
  if (CONFIG.error?.title) $('error-title').textContent = translate(CONFIG.error.title);
  if (CONFIG.error?.hint) $('error-hint').textContent = translate(CONFIG.error.hint);
}

function applyTheme(theme) {
  const popup = document.querySelector('.dl-popup');
  if (popup) popup.dataset.theme = THEMES.has(theme) ? theme : 'douyin';
}

EXT.storage.local.get(THEME_KEY, (stored) => applyTheme(stored?.[THEME_KEY]));
EXT.storage.onChanged?.addListener?.((changes, areaName) => {
  if (areaName === 'local' && changes[THEME_KEY]) applyTheme(changes[THEME_KEY].newValue);
});

function renderReady(info) {
  latestInfo = info;
  if (typeof CONFIG.renderReady === 'function') {
    CONFIG.renderReady(info, {
      title: $('item-title'),
      author: $('item-author'),
      sub: $('item-sub'),
      cover: $('item-cover'),
      coverPh: $('item-cover-ph'),
      extra: $('ready-extra'),
      tips: $('ready-tips')
    });
    return;
  }
  $('item-title').textContent = info.title || translate(CONFIG.title || '当前内容');
  const authorEl = $('item-author');
  if (info.author) {
    authorEl.textContent = info.author;
    authorEl.classList.remove('hidden');
  } else {
    authorEl.classList.add('hidden');
  }
  $('item-sub').textContent = info.sub || '';
  const cover = $('item-cover');
  const coverPh = $('item-cover-ph');
  if (info.cover && /^https:\/\//i.test(info.cover)) {
    cover.src = info.cover;
    cover.onload = () => {
      cover.classList.remove('hidden');
      coverPh.classList.add('hidden');
    };
    cover.onerror = () => {
      cover.classList.add('hidden');
      coverPh.classList.remove('hidden');
    };
  } else {
    cover.classList.add('hidden');
    coverPh.classList.remove('hidden');
  }
  fillList($('ready-tips'), CONFIG.readyTips || [
      '实际保存请点页面右下角图标打开的面板',
    '安装后请先 F5 刷新当前内容页'
  ]);
  const tags = $('quality-tags');
  const section = $('ready-quality');
  if (tags && section) {
    tags.replaceChildren();
    const labels = Array.isArray(info.qualities) ? info.qualities.filter(Boolean) : [];
    labels.forEach((label, index) => {
      const tag = document.createElement('span');
      tag.className = 'popup-q-tag' + (index === 0 ? ' best' : '');
      tag.textContent = label;
      tags.appendChild(tag);
    });
    section.classList.toggle('hidden', !labels.length);
  }
}

function isSiteUrl(url) {
  return CONFIG.isSiteUrl ? CONFIG.isSiteUrl(url) : Boolean(url);
}

function isContentUrl(url) {
  return CONFIG.isContentUrl ? CONFIG.isContentUrl(url) : isSiteUrl(url);
}

async function init() {
  try { await I18N?.ready; } catch (_) {}
  I18N?.translateDom?.(document.body);
  applyEmptyCopy();
  if (CONFIG.title) $('app-title').textContent = translate(CONFIG.title);
  showState('state-loading');
  const [tab] = await EXT.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isSiteUrl(tab.url)) {
    $('empty-current-site').textContent = formatCurrentSite(tab?.url);
    showState('state-empty');
    return;
  }

  const tabId = tab.id;
  try {
    const resp = await withTimeout(
      EXT.tabs.sendMessage(tabId, { type: CONFIG.getInfoType || 'DOWNLOADER_GET_INFO' }),
      8000,
      tr('loadingFailed')
    );
    if (resp?.ok && resp.data?.info) {
      renderReady(resp.data.info);
      showState('state-ready');
    } else if (isContentUrl(tab.url)) {
      throw new Error(translate(resp?.error || '无法读取页面，请先 F5'));
    } else {
      $('empty-current-site').textContent = formatCurrentSite(tab.url);
      showState('state-empty');
    }
  } catch (err) {
    if (!isContentUrl(tab.url)) {
      $('empty-current-site').textContent = formatCurrentSite(tab.url);
      showState('state-empty');
    } else {
      $('error-text').textContent = translate(err.message || tr('loadingFailed'));
      showState('state-error');
    }
  }

  $('btn-open-panel')?.addEventListener('click', async () => {
    try {
      await EXT.tabs.sendMessage(tabId, { type: CONFIG.openPanelType || 'DOWNLOADER_OPEN_PANEL' });
      window.close();
    } catch (_) {
      $('error-text').textContent = translate('无法打开面板，请刷新页面');
      showState('state-error');
    }
  });

  $('btn-retry')?.addEventListener('click', async () => {
    if (!tabId) return;
    try {
      await EXT.tabs.reload(tabId);
      window.close();
    } catch (_) {
      $('error-text').textContent = translate('无法刷新页面，请手动 F5');
      showState('state-error');
    }
  });
}

async function start() {
  await I18N?.ready;
  document.documentElement.lang = I18N?.language?.() === 'en' ? 'en' : 'zh-CN';
  I18N?.translateDom(document.querySelector('.dl-popup'));
  I18N?.onChange?.(() => {
    document.documentElement.lang = I18N.language() === 'en' ? 'en' : 'zh-CN';
    I18N.translateDom(document.querySelector('.dl-popup'));
    applyEmptyCopy();
    if (latestInfo) renderReady(latestInfo);
  });
  init();
}

start();
