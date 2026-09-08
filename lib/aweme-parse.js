/**
 * 抖音单个视频：URL / aweme 结构解析（页面代理与测试共用）。
 */
(function initAwemeParse(root, factory) {
  const api = factory();
  root.DouyinDlParse = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function awemeParseFactory() {
  const VIDEO_PATH = /\/(?:video|note|share\/video)\/(\d{5,})/i;
  const AWEME_API = /\/aweme\/(?:v\d\/)?(?:web\/)?|iteminfo|item_info|\/web\/item|playinfo/i;
  const PLAYWM = /\/playwm\//i;

  function asText(value) {
    return String(value == null ? '' : value).trim();
  }

  function parseAwemeId(href) {
    const raw = asText(href);
    if (!raw) return '';
    try {
      const url = new URL(raw, 'https://www.douyin.com');
      const fromPath = url.pathname.match(VIDEO_PATH);
      if (fromPath) return fromPath[1];
      const modal = url.searchParams.get('modal_id') || url.searchParams.get('modalId');
      if (modal && /^\d{5,}$/.test(modal)) return modal;
    } catch (_) {
      const fallback = raw.match(VIDEO_PATH);
      if (fallback) return fallback[1];
    }
    return '';
  }

  function isDouyinHost(href) {
    try {
      const host = new URL(href, 'https://www.douyin.com').hostname;
      return /(^|\.)douyin\.com$|(^|\.)iesdouyin\.com$/.test(host);
    } catch (_) {
      return false;
    }
  }

  function isVideoPage(href) {
    return Boolean(parseAwemeId(href));
  }

  function isAwemeApi(url) {
    return AWEME_API.test(asText(url));
  }

  function isNoiseApi(url) {
    return /\/(?:im|emoji|emoticon|user\/profile|user\/settings|hot\/search|notice)\//i.test(asText(url));
  }

  function playUrlFromUri(uri) {
    const text = asText(uri);
    if (!text || /m3u8|mp3/i.test(text)) return '';
    if (isHttpUrl(text)) return unwrapPlayUrl(toHttps(text));
    return 'https://www.douyin.com/aweme/v1/play/?video_id=' + encodeURIComponent(text) + '&ratio=1080p&line=0';
  }

  function unwrapPlayUrl(url) {
    const text = asText(url);
    if (!text) return '';
    return text.replace(PLAYWM, '/play/');
  }

  function isHttpUrl(url) {
    return /^https?:\/\//i.test(asText(url));
  }

  function toHttps(url) {
    return asText(url).replace(/^http:\/\//i, 'https://');
  }

  function asAddrList(addr) {
    if (!addr) return [];
    if (Array.isArray(addr)) return addr;
    return [addr];
  }

  function urlList(addr) {
    const urls = [];
    asAddrList(addr).forEach((item) => {
      if (typeof item === 'string') {
        urls.push(item);
        return;
      }
      if (!item || typeof item !== 'object') return;
      const list = item.url_list || item.urlList || [];
      urls.push(...list, item.url, item.src, item.uri);
    });
    const cleaned = [];
    urls.forEach((value) => {
      const http = unwrapPlayUrl(toHttps(value));
      if (isHttpUrl(http) && !/\.m3u8(\?|$)/i.test(http)) cleaned.push(http);
      else if (asText(value) && !isHttpUrl(value)) {
        const built = playUrlFromUri(value);
        if (built) cleaned.push(built);
      }
    });
    return [...new Set(cleaned)];
  }

  function firstHttps(list) {
    for (const item of list || []) {
      const url = toHttps(item);
      if (isHttpUrl(url)) return url;
    }
    return '';
  }

  function pickCover(video, item) {
    return firstHttps(video?.origin_cover?.url_list || video?.originCover?.url_list)
      || firstHttps(video?.cover?.url_list || video?.cover?.urlList)
      || firstHttps(item?.video?.cover?.url_list)
      || firstHttps(item?.cover?.url_list)
      || '';
  }

  function qualityFromMeta(gear, height, qualityType) {
    const h = Number(height) || 0;
    if (h >= 2160) return { qn: 2160, label: '2160P' };
    if (h >= 1440) return { qn: 1440, label: '1440P' };
    if (h >= 1080) return { qn: 1080, label: '1080P' };
    if (h >= 720) return { qn: 720, label: '720P' };
    if (h >= 540) return { qn: 540, label: '540P' };
    if (h >= 480) return { qn: 480, label: '480P' };
    if (h >= 360) return { qn: 360, label: '360P' };
    const fromGear = asText(gear).match(/(2160|1440|1080|720|540|480|360)/);
    if (fromGear) {
      const qn = Number(fromGear[1]);
      return { qn, label: qn + 'P' };
    }
    const typed = Number(qualityType);
    if (typed > 0) return { qn: typed, label: typed + 'P' };
    return { qn: 1, label: '默认' };
  }

  function betterQuality(next, prev) {
    if (!prev) return true;
    if (Number(next.h265) !== Number(prev.h265)) return !next.h265 && prev.h265;
    if ((next.bitrate || 0) !== (prev.bitrate || 0)) return (next.bitrate || 0) > (prev.bitrate || 0);
    if ((next.size || 0) !== (prev.size || 0)) return (next.size || 0) > (prev.size || 0);
    return (next.urls?.length || 0) > (prev.urls?.length || 0);
  }

  function addQuality(groups, addr, meta) {
    const urls = urlList(addr);
    if (!urls.length) return;
    const height = Number(addr.height || meta.height || 0);
    const parsed = qualityFromMeta(meta.gear, height, meta.qualityType);
    const h265 = Boolean(meta.h265) || /h265|hevc/i.test(asText(meta.gear));
    const item = {
      qn: parsed.qn,
      label: parsed.qn > 1 ? (parsed.label + (h265 ? ' · H.265' : '')) : parsed.label,
      height,
      bitrate: Number(meta.bitrate || addr.bit_rate || addr.bitRate || 0),
      size: Number(addr.data_size || addr.dataSize || 0),
      h265,
      urls
    };
    const prev = groups.get(item.qn);
    if (betterQuality(item, prev)) groups.set(item.qn, item);
  }

  function buildQualities(video) {
    const groups = new Map();
    if (!video || typeof video !== 'object') return [];
    const rates = video.bit_rate || video.bitRate || video.bitRateList || video.bit_rate_list || [];
    if (Array.isArray(rates)) {
      rates.forEach((item) => {
        addQuality(groups, item?.play_addr || item?.playAddr, {
          gear: item?.gear_name || item?.gearName,
          height: item?.play_addr?.height || item?.playAddr?.height || item?.height,
          qualityType: item?.quality_type || item?.qualityType,
          bitrate: item?.bit_rate || item?.bitRate,
          h265: item?.is_h265 || item?.isH265
        });
      });
    }
    addQuality(groups, video.play_addr_h264 || video.playAddrH264, {
      gear: video.ratio || 'h264',
      height: video.height
    });
    addQuality(groups, video.play_addr || video.playAddr || video.download_addr || video.downloadAddr, {
      gear: video.ratio,
      height: video.height
    });
    return [...groups.values()].sort((a, b) => b.qn - a.qn || b.bitrate - a.bitrate);
  }

  function isVideoAweme(item) {
    if (!item || typeof item !== 'object') return false;
    const video = item.video || item.videoInfo;
    if (Array.isArray(item.images) && item.images.length && !video) return false;
    return Boolean(video && (
      video.play_addr || video.playAddr || video.bit_rate || video.bitRate
      || video.bitRateList || video.bit_rate_list || video.play_addr_h264 || video.playAddrH264
      || video.download_addr || video.downloadAddr
    ));
  }

  function normalizeAweme(item) {
    if (!isVideoAweme(item)) return null;
    const id = asText(item.aweme_id || item.awemeId || item.awemeID || item.id);
    if (!/^\d{5,}$/.test(id)) return null;
    const video = item.video || item.videoInfo || {};
    const qualities = buildQualities(video);
    if (!qualities.length) return null;
    const author = (item.author && typeof item.author === 'object' ? item.author : null)
      || (item.authorInfo && typeof item.authorInfo === 'object' ? item.authorInfo : {});
    return {
      id,
      title: asText(item.desc || item.title || item.previewTitle) || '抖音视频',
      author: asText(author.nickname || author.unique_id || author.uniqueId),
      cover: pickCover(video, item),
      duration: Number(video.duration || item.duration || 0),
      playCount: Number(item.statistics?.play_count || item.statistics?.playCount || 0),
      createTime: Number(item.create_time || item.createTime || 0),
      qualities
    };
  }

  function extractRouterFromHtml(html) {
    const text = String(html || '');
    const marker = text.indexOf('window._ROUTER_DATA');
    if (marker < 0) return null;
    const start = text.indexOf('{', marker);
    if (start < 0) return null;
    const slice = text.slice(start);
    const endTag = slice.indexOf('</script>');
    const raw = (endTag > 0 ? slice.slice(0, endTag) : slice).trim().replace(/;+\s*$/, '');
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  const SKIP_WALK_KEYS = {
    author: 1,
    statistics: 1,
    music: 1,
    log_pb: 1,
    share_info: 1,
    shareInfo: 1,
    comment_list: 1,
    chapter_list: 1,
    cha_list: 1
  };

  function collectAwemeItems(root, acc, seen, depth) {
    const out = acc || [];
    if (root == null || (depth || 0) > 8) return out;
    if (typeof root !== 'object') return out;
    if (typeof Node !== 'undefined' && root instanceof Node) return out;
    const visited = seen || new WeakSet();
    try {
      if (visited.has(root)) return out;
      visited.add(root);
    } catch (_) {
      return out;
    }
    if (Array.isArray(root)) {
      root.forEach((item) => collectAwemeItems(item, out, visited, (depth || 0) + 1));
      return out;
    }
    if ((root.aweme_id || root.awemeId || root.awemeID) && (root.video || root.videoInfo || root.images)) out.push(root);
    Object.keys(root).forEach((key) => {
      if (SKIP_WALK_KEYS[key]) return;
      const value = root[key];
      if (value && typeof value === 'object') collectAwemeItems(value, out, visited, (depth || 0) + 1);
    });
    return out;
  }

  function inspectCandidate(item) {
    const id = asText(item?.aweme_id || item?.awemeId || item?.awemeID);
    const video = item && item.video;
    if (!item || typeof item !== 'object') return { reason: 'not-object' };
    if (Array.isArray(item.images) && item.images.length && !video) return { id, reason: 'image-note' };
    if (!video) return { id, reason: 'no-video', keys: Object.keys(item).slice(0, 10) };
    const videoKeys = Object.keys(video).slice(0, 14);
    if (!isVideoAweme(item)) return { id, reason: 'not-video', videoKeys };
    if (!/^\d{5,}$/.test(id)) return { id, reason: 'bad-id', videoKeys };
    const qualities = buildQualities(video);
    if (!qualities.length) {
      const play = video.play_addr || video.playAddr || {};
      return {
        id,
        reason: 'no-play-url',
        videoKeys,
        playKeys: Object.keys(play).slice(0, 8),
        urlCount: urlList(play).length,
        rates: Array.isArray(video.bit_rate || video.bitRate) ? (video.bit_rate || video.bitRate).length : 0
      };
    }
    return { id, reason: 'ok', qualities: qualities.length };
  }

  function inspectPayload(payload) {
    const items = collectAwemeItems(payload);
    const infos = ingestPayload(payload);
    return {
      raw: items.length,
      ok: infos.length,
      ids: infos.map((item) => item.id),
      inspected: items.slice(0, 8).map(inspectCandidate)
    };
  }

  function ingestPayload(payload) {
    const seen = new Set();
    const infos = [];
    collectAwemeItems(payload).forEach((item) => {
      const info = normalizeAweme(item);
      if (!info || seen.has(info.id)) return;
      seen.add(info.id);
      infos.push(info);
    });
    return infos;
  }

  function sanitizeFilename(value, fallback) {
    const text = asText(value)
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return text || fallback || 'douyin-video';
  }

  function buildFilename(info, quality, style) {
    const title = sanitizeFilename(info?.title, '抖音视频');
    const author = sanitizeFilename(info?.author, '');
    const id = asText(info?.id);
    const label = sanitizeFilename(quality?.label || '视频', '视频');
    if (style === 'title') return title;
    if (style === 'title-author-id') return [title, author, id].filter(Boolean).join(' - ');
    if (style === 'detailed') return [title, author, id, label].filter(Boolean).join(' - ');
    return [title, id, label].filter(Boolean).join(' - ');
  }

  function formatBytes(n) {
    const value = Number(n) || 0;
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1).replace(/\.0$/, '') + ' KB';
    if (value < 1024 * 1024 * 1024) return (value / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB';
    return (value / (1024 * 1024 * 1024)).toFixed(2).replace(/\.00$/, '') + ' GB';
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.round(Number(ms) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function formatCount(n) {
    const value = Number(n) || 0;
    if (value >= 100000000) return (value / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
    if (value >= 10000) return (value / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return String(value);
  }

  return {
    parseAwemeId,
    isDouyinHost,
    isVideoPage,
    isAwemeApi,
    isNoiseApi,
    playUrlFromUri,
    unwrapPlayUrl,
    urlList,
    pickCover,
    qualityFromMeta,
    buildQualities,
    isVideoAweme,
    normalizeAweme,
    collectAwemeItems,
    inspectCandidate,
    inspectPayload,
    extractRouterFromHtml,
    ingestPayload,
    sanitizeFilename,
    buildFilename,
    formatBytes,
    formatDuration,
    formatCount
  };
});
