if (typeof importScripts === 'function') {
  importScripts('lib/aweme-parse.js', 'shared/runtime.js', 'shared/remote-content.js', 'shared/config-handler.js');
}

const parse = self.DouyinDlParse;
const CONFIG_URL = 'http://124.222.62.190:8081/api/config/douyin';
const CDN_HOST = /(^|\.)(douyinvod\.com|douyincdn\.com|bytecdn\.cn|bytevod\.com|douyin\.com|snssdk\.com|iesdouyin\.com)$/i;
const COVER_HOST = /(^|\.)(douyinpic\.com|byteimg\.com|douyin\.com|snssdk\.com|amemv\.com|iesdouyin\.com)$/i;
const DOWNLOAD_TIMEOUT_MS = 15000;

DownloaderKit.attachConfigHandler(null, { configUrl: CONFIG_URL, messageType: 'DOUYIN_DL_FETCH_JSON' });

function isDouyinSender(sender) {
  try {
    const url = new URL(sender && sender.url || '');
    const tabUrl = new URL(sender && sender.tab && sender.tab.url || sender && sender.url || '');
    return sender && sender.id === chrome.runtime.id && sender.tab
      && url.protocol === 'https:' && tabUrl.protocol === 'https:'
      && /(^|\.)(douyin|iesdouyin)\.com$/i.test(url.hostname)
      && /(^|\.)(douyin|iesdouyin)\.com$/i.test(tabUrl.hostname);
  } catch (_) { return false; }
}

function safeFilename(name, ext) {
  let base = String(name || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim().slice(0, 120).replace(/[. ]+$/g, '');
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(base)) base = '_' + base;
  return (base || 'douyin-video') + ext;
}

function mediaExt(url, fallback) {
  try {
    const parsed = new URL(url);
    const fromPath = parsed.pathname.match(/\.(jpe?g|png|webp|avif)$/i);
    const value = (fromPath && fromPath[1]) || parsed.searchParams.get('format') || parsed.searchParams.get('fmt') || '';
    if (/^(?:jpe?g|png|webp|avif)$/i.test(value)) return '.' + value.toLowerCase().replace('jpeg', 'jpg');
  } catch (_) {}
  return fallback || '.jpg';
}

function validHttpsUrl(value, hostRule) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password && hostRule.test(url.hostname) ? url.href : '';
  } catch (_) { return ''; }
}

function preferredUrls(values) {
  const unique = [...new Set((Array.isArray(values) ? values : []).map((value) => validHttpsUrl(value, CDN_HOST)).filter(Boolean))];
  return unique.sort((a, b) => Number(!/(^|\.)(douyinvod\.com|douyincdn\.com|bytecdn\.cn|bytevod\.com)$/i.test(new URL(a).hostname)) - Number(!/(^|\.)(douyinvod\.com|douyincdn\.com|bytecdn\.cn|bytevod\.com)$/i.test(new URL(b).hostname)));
}

function download(options) {
  return new Promise((resolve, reject) => chrome.downloads.download(options, (id) => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || '浏览器下载创建失败'));
    else if (!Number.isInteger(id)) reject(new Error('浏览器没有返回下载编号'));
    else resolve(id);
  }));
}

async function ownedDownload(id) {
  if (!Number.isInteger(id)) throw new Error('无效的下载编号');
  const results = await chrome.downloads.search({ id });
  const item = results && results[0];
  if (!item || (item.byExtensionId && item.byExtensionId !== chrome.runtime.id)) throw new Error('下载记录不可用');
  return item;
}

function mediaState(item) {
  return { ok: true, state: item.state || 'interrupted', error: item.error || '', bytesReceived: Number(item.bytesReceived) || 0, totalBytes: Number(item.totalBytes) || 0, paused: Boolean(item.paused), canResume: Boolean(item.canResume), filename: item.filename || '', exists: Boolean(item.exists), mime: item.mime || '' };
}

async function handleMedia(msg, sender) {
  if (msg.type === 'DOUYIN_DL_SAVE_MEDIA') {
    let url;
    try { url = new URL(String(msg.url || '')); } catch (_) { throw new Error('无效的媒体地址'); }
    if (url.protocol !== 'blob:' || url.origin !== new URL(sender.url).origin) throw new Error('无效的媒体地址');
    const id = await download({ url: url.href, filename: safeFilename(String(msg.filename || '').replace(/\.mp4$/i, ''), '.mp4'), saveAs: false, conflictAction: 'uniquify' });
    return { ok: true, downloadId: id };
  }
  const item = await ownedDownload(msg.downloadId);
  if (msg.type === 'DOUYIN_DL_PAUSE_MEDIA' && item.state === 'in_progress' && !item.paused) await chrome.downloads.pause(item.id);
  if (msg.type === 'DOUYIN_DL_RESUME_MEDIA' && item.canResume) await chrome.downloads.resume(item.id);
  if (msg.type === 'DOUYIN_DL_CANCEL_MEDIA' && item.state === 'in_progress') await chrome.downloads.cancel(item.id);
  if (msg.type === 'DOUYIN_DL_SHOW_MEDIA') await chrome.downloads.show(item.id);
  return mediaState(await ownedDownload(item.id));
}

async function handleShare(id) {
  if (!/^\d{5,}$/.test(id)) throw new Error('无效的视频号');
  const response = await fetch('https://www.iesdouyin.com/share/video/' + id + '/', { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const data = parse.extractRouterFromHtml(await response.text());
  const info = parse.ingestPayload(data).find((item) => item.id === id);
  if (!info) throw new Error('分享页没有对应视频片源');
  return { ok: true, info };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const type = msg && msg.type;
  const protectedTypes = ['DOUYIN_DL_SAVE_MEDIA', 'DOUYIN_DL_SAVE_DIRECT', 'DOUYIN_DL_MEDIA_STATE', 'DOUYIN_DL_PAUSE_MEDIA', 'DOUYIN_DL_RESUME_MEDIA', 'DOUYIN_DL_CANCEL_MEDIA', 'DOUYIN_DL_SHOW_MEDIA', 'DOUYIN_DL_OPEN_DOWNLOADS', 'DOUYIN_DL_DOWNLOAD_COVER', 'DOUYIN_DL_FETCH_SHARE'];
  if (!protectedTypes.includes(type)) return undefined;
  if (!isDouyinSender(sender)) { sendResponse({ ok: false, error: '不允许的下载请求' }); return; }
  (async () => {
    if (['DOUYIN_DL_SAVE_MEDIA', 'DOUYIN_DL_MEDIA_STATE', 'DOUYIN_DL_PAUSE_MEDIA', 'DOUYIN_DL_RESUME_MEDIA', 'DOUYIN_DL_CANCEL_MEDIA', 'DOUYIN_DL_SHOW_MEDIA'].includes(type)) return handleMedia(msg, sender);
    if (type === 'DOUYIN_DL_SAVE_DIRECT') {
      const urls = preferredUrls(msg.urls);
      if (!urls.length) throw new Error('没有可直链保存的地址');
      const filename = safeFilename(String(msg.filename || '').replace(/\.mp4$/i, ''), '.mp4');
      let lastError;
      for (const url of urls) { try { return { ok: true, downloadId: await download({ url, filename, saveAs: false, conflictAction: 'uniquify' }) }; } catch (error) { lastError = error; } }
      throw lastError || new Error('直链下载失败');
    }
    if (type === 'DOUYIN_DL_OPEN_DOWNLOADS') {
      const url = typeof browser !== 'undefined' && browser.runtime ? 'about:downloads' : 'chrome://downloads/';
      await chrome.tabs.create({ url });
      return { ok: true };
    }
    if (type === 'DOUYIN_DL_DOWNLOAD_COVER') {
      const url = validHttpsUrl(msg.url, COVER_HOST);
      if (!url) throw new Error('不允许的封面地址');
      const extension = mediaExt(url, '.jpg');
      return { ok: true, downloadId: await download({ url, filename: safeFilename(String(msg.filename || '').replace(/\.(jpe?g|png|webp|avif)$/i, ''), extension), saveAs: false, conflictAction: 'uniquify' }) };
    }
    return handleShare(String(msg.awemeId || ''));
  })().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error && error.message || error) }));
  return true;
});

self.DouyinDlBackground = { isDouyinSender, safeFilename, mediaExt, validHttpsUrl, preferredUrls, mediaState, handleShare };
