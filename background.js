importScripts('lib/aweme-parse.js', 'shared/runtime.js', 'shared/remote-content.js', 'shared/config-handler.js');

const parse = self.DouyinDlParse;

const CONFIG_URL = 'https://download-config-hub.nutmeg-venus-6882.chatgpt.site/api/config/douyin';
const COVER_HOST = /(^|\.)(douyinpic\.com|byteimg\.com|douyin\.com|snssdk\.com|amemv\.com|iesdouyin\.com)$/i;

DownloaderKit.attachConfigHandler(null, {
  configUrl: CONFIG_URL,
  messageType: 'DOUYIN_DL_FETCH_JSON'
});

function isDouyinSender(sender) {
  try {
    const url = new URL(sender.url || '');
    return sender.id === chrome.runtime.id
      && sender.tab
      && url.protocol === 'https:'
      && /(^|\.)(douyin|iesdouyin)\.com$/.test(url.hostname);
  } catch (_) {
    return false;
  }
}

function safeFilename(name, ext) {
  const base = String(name || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\.+$/, '')
    .trim()
    .slice(0, 120);
  return (base || 'douyin-video') + ext;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (['DOUYIN_DL_SAVE_MEDIA', 'DOUYIN_DL_MEDIA_STATE', 'DOUYIN_DL_CANCEL_MEDIA'].includes(msg?.type)) {
    (async () => {
      if (!isDouyinSender(sender)) throw new Error('不允许的下载请求');
      if (msg.type === 'DOUYIN_DL_SAVE_MEDIA') {
        const url = new URL(String(msg.url || ''));
        if (url.protocol !== 'blob:' || url.origin !== new URL(sender.url).origin) {
          throw new Error('无效的媒体地址');
        }
        const filename = safeFilename(String(msg.filename || '').replace(/\.mp4$/i, ''), '.mp4');
        if (!filename || /[\\/\x00-\x1f]/.test(filename)) throw new Error('无效的文件名');
        const downloadId = await chrome.downloads.download({
          url: url.href,
          filename,
          saveAs: false,
          conflictAction: 'uniquify'
        });
        return { ok: true, downloadId };
      }
      if (!Number.isInteger(msg.downloadId)) throw new Error('无效的下载编号');
      const [item] = await chrome.downloads.search({ id: msg.downloadId });
      if (!item || item.byExtensionId !== chrome.runtime.id) {
        throw new Error('下载记录不可用，请打开浏览器下载记录检查');
      }
      if (msg.type === 'DOUYIN_DL_CANCEL_MEDIA' && item.state === 'in_progress') {
        await chrome.downloads.cancel(item.id);
      }
      return { ok: true, state: item.state, error: item.error || '', bytesReceived: item.bytesReceived || 0 };
    })().then(sendResponse, (error) => sendResponse({ ok: false, error: String(error.message || error) }));
    return true;
  }

  if (msg?.type === 'DOUYIN_DL_SAVE_DIRECT') {
    if (!isDouyinSender(sender)) {
      sendResponse({ ok: false, error: '不允许的下载请求' });
      return;
    }
    const urls = Array.isArray(msg.urls) ? msg.urls : [];
    const filename = safeFilename(String(msg.filename || '').replace(/\.mp4$/i, ''), '.mp4');
    const allowed = /(^|\.)(douyinvod\.com|douyincdn\.com|bytecdn\.cn|bytevod\.com|douyin\.com|snssdk\.com|iesdouyin\.com)$/i;
    const url = urls.find((item) => {
      try {
        const parsed = new URL(String(item || ''));
        return parsed.protocol === 'https:' && allowed.test(parsed.hostname);
      } catch (_) {
        return false;
      }
    });
    if (!url) {
      sendResponse({ ok: false, error: '没有可直链保存的地址' });
      return;
    }
    chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      const error = chrome.runtime.lastError;
      sendResponse(error ? { ok: false, error: error.message || '直链下载失败' } : { ok: true, downloadId });
    });
    return true;
  }

  if (msg?.type === 'DOUYIN_DL_DOWNLOAD_COVER') {
    if (!isDouyinSender(sender)) {
      sendResponse({ ok: false, error: '不允许的下载请求' });
      return;
    }
    const url = String(msg.url || '').replace(/^http:\/\//i, 'https://');
    let host = '';
    try { host = new URL(url).hostname; } catch (_) {}
    if (!/^https:\/\//i.test(url) || !COVER_HOST.test(host)) {
      sendResponse({ ok: false, error: '不允许的封面地址' });
      return;
    }
    chrome.downloads.download({
      url,
      filename: safeFilename(String(msg.filename || '').replace(/\.(jpe?g|png|webp)$/i, ''), '.jpg'),
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      const error = chrome.runtime.lastError;
      sendResponse(error ? { ok: false, error: error.message || '封面下载失败' } : { ok: true, downloadId });
    });
    return true;
  }

  if (msg?.type === 'DOUYIN_DL_FETCH_SHARE') {
    if (!isDouyinSender(sender)) {
      sendResponse({ ok: false, error: '不允许的请求' });
      return;
    }
    const id = String(msg.awemeId || '');
    if (!/^\d{5,}$/.test(id)) {
      sendResponse({ ok: false, error: '无效的视频号' });
      return;
    }
    const url = 'https://www.iesdouyin.com/share/video/' + id + '/';
    fetch(url, { redirect: 'follow', cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then((html) => {
        const data = parse.extractRouterFromHtml(html);
        const infos = parse.ingestPayload(data);
        const info = infos.find((item) => item.id === id) || infos[0] || null;
        sendResponse(info ? { ok: true, info } : { ok: false, error: '分享页没有视频片源' });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message || '分享页读取失败' }));
    return true;
  }

  return undefined;
});
