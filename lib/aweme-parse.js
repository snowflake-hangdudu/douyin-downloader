/**
 * 抖音单个视频：URL / aweme 结构解析（页面代理与测试共用）。
 */
(function initAwemeParse(root, factory) {
  const api = factory();
  root.DouyinDlParse = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function awemeParseFactory() {
  const VIDEO_PATH = /\/(?:video|note|share\/video)\/(\d{5,})/i;
  const MIX_PATH = /\/(?:collection|mix\/detail|mix)\/(\d{5,})/i;
  const AWEME_API = /\/aweme\/(?:v\d\/)?(?:web\/)?|iteminfo|item_info|\/web\/item|playinfo/i;
  const MIX_API = /\/(?:mix|series)\//i;
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
    return /\/(?:im|emoji|emoticon|user\/profile|user\/settings|hot\/search|notice|mix\/watch|series\/watch)\//i.test(asText(url));
  }

  function isMixApi(url) {
    const text = asText(url);
    return MIX_API.test(text) || /[?&]mix_id=\d+/i.test(text);
  }

  function parseMixId(href) {
    const raw = asText(href);
    if (!raw) return '';
    try {
      const url = new URL(raw, 'https://www.douyin.com');
      const fromPath = url.pathname.match(MIX_PATH);
      if (fromPath) return fromPath[1];
      const mix = url.searchParams.get('mix_id') || url.searchParams.get('mixId')
        || url.searchParams.get('series_id') || url.searchParams.get('seriesId');
      if (mix && /^\d{5,}$/.test(mix)) return mix;
    } catch (_) {
      const fallback = raw.match(MIX_PATH) || raw.match(/[?&]mix_id=(\d{5,})/i);
      if (fallback) return fallback[1];
    }
    return '';
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

  function isLikelyAudioOnlyUrl(url) {
    const text = asText(url);
    if (!text) return false;
    return /\/audio\/|mime_type=(?:audio|%25(?:32|35|37)audio)|(?:^|[?&])line=audio|audio_mp4|\.m4a(?:[?#]|$)/i.test(text);
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
      urls.push(...asAddrList(list), item.url, item.src, item.uri);
    });
    const cleaned = [];
    urls.forEach((value) => {
      const http = unwrapPlayUrl(toHttps(value));
      if (isHttpUrl(http) && !/\.m3u8(\?|$)/i.test(http) && !isLikelyAudioOnlyUrl(http)) cleaned.push(http);
      else if (asText(value) && !isHttpUrl(value)) {
        const built = playUrlFromUri(value);
        if (built && !isLikelyAudioOnlyUrl(built)) cleaned.push(built);
      }
    });
    return [...new Set(cleaned)];
  }

  function estimateQualityBytes(quality, durationMs) {
    if (!quality || typeof quality !== 'object') return 0;
    const dataSize = Number(quality.size) || 0;
    const durationSec = Math.max(Number(durationMs) || 0, 1000) / 1000;
    const bitrate = Number(quality.bitrate) || 0;
    const fromBitrate = bitrate > 0 ? Math.round(bitrate * durationSec / 8) : 0;
    if (fromBitrate > 0 && dataSize > 0) {
      const ratio = fromBitrate / dataSize;
      if (ratio < 0.6 || ratio > 1.6) return fromBitrate;
      return Math.max(dataSize, fromBitrate);
    }
    return dataSize || fromBitrate || 0;
  }

  function pickDownloadUrls(selected, qualities) {
    const list = Array.isArray(qualities) ? qualities : [];
    const qn = Number(selected?.qn) || 0;
    const urls = [];
    const pushItem = (item) => {
      if (!item?.urls?.length) return;
      item.urls.forEach((url) => {
        if (!isLikelyAudioOnlyUrl(url)) urls.push(url);
      });
    };
    if (selected?.h265) {
      list
        .filter((item) => !item.h265 && item.qn <= qn && item.urls?.length)
        .sort((a, b) => b.qn - a.qn)
        .forEach(pushItem);
    } else if (selected) {
      pushItem(selected);
    }
    if (selected?.h265) pushItem(selected);
    if (!urls.length) {
      list.filter((item) => !item.h265).sort((a, b) => b.qn - a.qn).forEach(pushItem);
    }
    if (!urls.length && selected) pushItem(selected);
    return [...new Set(urls)];
  }

  function firstHttps(list) {
    for (const item of asAddrList(list)) {
      if (item && typeof item === 'object') {
        const nested = firstHttps(item.url_list || item.urlList || item.url || item.src);
        if (nested) return nested;
        continue;
      }
      const url = toHttps(item);
      if (isHttpUrl(url)) return url;
    }
    return '';
  }

  function coverFromValue(value) {
    if (!value) return '';
    if (typeof value === 'string') {
      const url = toHttps(value.trim());
      return isHttpUrl(url) ? url : '';
    }
    if (typeof value !== 'object') return '';
    return firstHttps(value.url_list || value.urlList || value.url || value.src)
      || coverFromValue(value.uri && isHttpUrl(toHttps(value.uri)) ? value.uri : '');
  }

  function pickCover(video, item) {
    const bags = [
      video?.origin_cover, video?.originCover,
      video?.big_cover, video?.bigCover,
      video?.cover, video?.dynamic_cover, video?.dynamicCover,
      video?.animated_cover, video?.animatedCover,
      item?.video?.origin_cover, item?.video?.cover,
      item?.origin_cover, item?.cover,
      item?.rawdata?.cover, item?.raw_data?.cover
    ];
    for (const bag of bags) {
      const url = coverFromValue(bag);
      if (url) return url;
    }
    return '';
  }

  function scoreCoverUrl(url) {
    const text = asText(url);
    if (!text) return -999;
    let score = 0;
    if (/douyinpic|byteimg|iesdouyin|tos-cn|p3-sign|p9-sign/i.test(text)) score += 12;
    if (/origin|large|tplv-dy.*(?:aweme|pc)/i.test(text)) score += 8;
    if (/~tplv-/.test(text)) score += 4;
    if (/\d{3,4}:\d{3,4}/.test(text)) score += 3;
    if (/poster|snap|blur|firstframe|x-signature|aweme-avatar|100x100|72x72/i.test(text)) score -= 10;
    if (/avatar|emoji|emoticon|icon|logo|sticker/i.test(text)) score -= 20;
    const small = text.match(/(?:^|[?&_])(?:w|width)=(\d+)/i) || text.match(/(\d{2,3})x(\d{2,3})/);
    if (small) {
      const w = Number(small[1]);
      const h = Number(small[2] || small[1]);
      if (w < 180 || h < 100) score -= 15;
    }
    if (/\.webp(?:\?|$)/i.test(text)) score += 1;
    return score;
  }

  function isBadCoverUrl(url) {
    const text = asText(url);
    if (!text || /^data:/i.test(text)) return true;
    return scoreCoverUrl(text) < 0;
  }

  function isSuspiciousCoverUrl(url) {
    const text = asText(url);
    if (!text) return true;
    if (isBadCoverUrl(text)) return true;
    if (/poster|snap|blur|firstframe|x-signature|dynamic/i.test(text)) return true;
    if (!/douyinpic|byteimg|iesdouyin|tos-cn|p3-sign|p9-sign/i.test(text)) return true;
    return false;
  }

  function isLikelyLowResCover(current, candidate) {
    if (!current) return true;
    if (!candidate || current === candidate) return false;
    if (isSuspiciousCoverUrl(current)) return true;
    if (scoreCoverUrl(candidate) - scoreCoverUrl(current) >= 6) return true;
    return /poster|snap|blur|firstframe/i.test(current) && !/poster|snap|blur|firstframe/i.test(candidate);
  }

  function imageExtension(url) {
    const text = asText(url);
    const format = text.match(/[?&](?:format|image_format)=([a-z0-9]+)/i)?.[1]
      || text.match(/\.(?:jpg|jpeg|png|webp|avif)(?:[?#]|$)/i)?.[0]?.slice(1).replace(/[?#].*$/, '')
      || (/webp/i.test(text) ? 'webp' : 'jpg');
    if (/^jpe?g$/i.test(format)) return 'jpg';
    return /^(?:png|webp|avif)$/i.test(format) ? format.toLowerCase() : 'jpg';
  }

  function qualityFromMeta(gear, width, height) {
    const fromGear = asText(gear).match(/(2160|1440|1080|720|540|480|360)/);
    if (fromGear) {
      const qn = Number(fromGear[1]);
      return { qn, label: qn + 'P' };
    }
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    // P 数表示较短边；竖屏视频不能把 1920 高误判成 1920P。
    const shortSide = w > 0 && h > 0 ? Math.min(w, h) : Math.max(w, h);
    if (shortSide >= 2160) return { qn: 2160, label: '2160P' };
    if (shortSide >= 1440) return { qn: 1440, label: '1440P' };
    if (shortSide >= 1080) return { qn: 1080, label: '1080P' };
    if (shortSide >= 720) return { qn: 720, label: '720P' };
    if (shortSide >= 540) return { qn: 540, label: '540P' };
    if (shortSide >= 480) return { qn: 480, label: '480P' };
    if (shortSide >= 360) return { qn: 360, label: '360P' };
    return { qn: 1, label: '默认' };
  }

  function betterQuality(next, prev) {
    if (!prev) return true;
    if (Number(next.h265) !== Number(prev.h265)) return !next.h265 && prev.h265;
    if ((next.bitrate || 0) !== (prev.bitrate || 0)) return (next.bitrate || 0) > (prev.bitrate || 0);
    if ((next.size || 0) !== (prev.size || 0)) return (next.size || 0) > (prev.size || 0);
    return (next.urls?.length || 0) > (prev.urls?.length || 0);
  }

  function isUserFacingGear(gear) {
    const text = asText(gear);
    if (!text || /adapt|lowest|lower_/i.test(text)) return false;
    return /(2160|1440|1080|720|540|480|360)/.test(text);
  }

  function addQuality(groups, addr, meta) {
    const urls = urlList(addr);
    if (!urls.length) return;
    const width = Number(addr.width || meta.width || 0);
    const height = Number(addr.height || meta.height || 0);
    // bit_rate 的 gear 是明确档位；整段 video.ratio 不能覆盖地址自身尺寸。
    const gear = meta.preferGear === false && (width > 0 || height > 0) ? '' : meta.gear;
    const parsed = qualityFromMeta(gear, width, height);
    const h265 = Boolean(meta.h265) || /h265|hevc/i.test(asText(meta.gear));
    const item = {
      qn: parsed.qn,
      label: parsed.label,
      width,
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
    const list = Array.isArray(rates) ? rates : [];
    const userRates = list.filter((item) => isUserFacingGear(item?.gear_name || item?.gearName));
    (userRates.length ? userRates : list).forEach((item) => {
      addQuality(groups, item?.play_addr || item?.playAddr, {
        gear: item?.gear_name || item?.gearName,
        width: item?.play_addr?.width || item?.playAddr?.width || item?.width,
        height: item?.play_addr?.height || item?.playAddr?.height || item?.height,
        bitrate: item?.bit_rate || item?.bitRate,
        h265: item?.is_h265 || item?.isH265
      });
    });
    // 当前播放地址的宽高经常是画面尺寸，不能据此再造一档清晰度。
    function addKnownTier(addr, meta) {
      if (!groups.size) {
        addQuality(groups, addr, meta);
        return;
      }
      const width = Number(addr?.width || meta.width || 0);
      const height = Number(addr?.height || meta.height || 0);
      const gear = meta.preferGear === false && (width > 0 || height > 0) ? '' : meta.gear;
      const parsed = qualityFromMeta(gear, width, height);
      if (!groups.has(parsed.qn)) return;
      addQuality(groups, addr, meta);
    }
    addKnownTier(video.play_addr_h264 || video.playAddrH264, {
      gear: video.ratio || 'h264',
      width: video.width,
      height: video.height,
      preferGear: false
    });
    addKnownTier(video.play_addr || video.playAddr || video.download_addr || video.downloadAddr, {
      gear: video.ratio,
      width: video.width,
      height: video.height,
      preferGear: false
    });
    // 抖音网页播放器在已有 1080/540 等正式档时不提供 720P，720 只是内部转码档。
    if (groups.has(720) && [...groups.keys()].some((qn) => qn !== 720 && qn >= 540)) groups.delete(720);
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

  function extractMixMeta(source) {
    const mix = source && typeof source === 'object'
      ? (source.mix_info || source.mixInfo || source.series_info || source.seriesInfo
        || (source.mix_id || source.mixId || source.series_id || source.seriesId || source.mix_name || source.series_name
          ? source : null))
      : null;
    if (!mix || typeof mix !== 'object') return null;
    const id = asText(mix.mix_id || mix.mixId || mix.series_id || mix.seriesId || mix.id);
    if (!/^\d{5,}$/.test(id)) return null;
    const stat = mix.stat && typeof mix.stat === 'object' ? mix.stat : {};
    return {
      id,
      name: asText(mix.mix_name || mix.mixName || mix.series_name || mix.seriesName || mix.name || mix.title) || '合集',
      cover: pickCover({}, mix) || firstHttps(mix.cover_url || mix.coverUrl || mix.cover),
      episode: Number(stat.current_episode || stat.currentEpisode || mix.current_episode || mix.episode || 0) || 0,
      updatedTo: Number(stat.updated_to_episode || stat.updatedToEpisode || mix.updated_to_episode || 0) || 0,
      playCount: Number(stat.play_vv || stat.playVv || mix.play_vv || 0) || 0
    };
  }

  function normalizeMixListItem(item, meta) {
    const full = normalizeAweme(item);
    if (full) return full;
    if (!item || typeof item !== 'object') return null;
    const id = asText(item.aweme_id || item.awemeId || item.awemeID || item.id);
    if (!/^\d{5,}$/.test(id)) return null;
    const video = item.video || item.videoInfo || {};
    const author = (item.author && typeof item.author === 'object' ? item.author : null)
      || (item.authorInfo && typeof item.authorInfo === 'object' ? item.authorInfo : {});
    const mix = extractMixMeta(item) || meta || null;
    const qualities = buildQualities(video);
    return {
      id,
      title: asText(item.desc || item.title || item.previewTitle) || '抖音视频',
      author: asText(author.nickname || author.unique_id || author.uniqueId),
      cover: pickCover(video, item),
      duration: Number(video.duration || item.duration || 0),
      playCount: Number(item.statistics?.play_count || item.statistics?.playCount || 0),
      createTime: Number(item.create_time || item.createTime || 0),
      qualities,
      mix: mix || undefined,
      episode: Number(mix?.episode || item.mix_info?.stat?.current_episode || 0) || 0
    };
  }

  function summarizeMixPayload(payload) {
    if (!payload || typeof payload !== 'object') return '非对象';
    const list = payload.aweme_list || payload.awemeList || payload.item_list || [];
    return [
      'status=' + (payload.status_code ?? '?'),
      'msg=' + asText(payload.status_msg || payload.message || '').slice(0, 40),
      'list=' + (Array.isArray(list) ? list.length : 0)
    ].join(' ');
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
    const mix = extractMixMeta(item);
    return {
      id,
      title: asText(item.desc || item.title || item.previewTitle) || '抖音视频',
      author: asText(author.nickname || author.unique_id || author.uniqueId),
      cover: pickCover(video, item),
      duration: Number(video.duration || item.duration || 0),
      playCount: Number(item.statistics?.play_count || item.statistics?.playCount || 0),
      createTime: Number(item.create_time || item.createTime || 0),
      qualities,
      mix: mix || undefined,
      episode: mix?.episode || 0
    };
  }

  function ingestMixPayload(payload, url) {
    if (!payload || typeof payload !== 'object') return null;
    const fromUrl = parseMixId(url);
    const meta = extractMixMeta(payload.mix_info || payload.mixInfo || payload.series_info || payload.seriesInfo || payload)
      || (fromUrl ? { id: fromUrl, name: '合集', cover: '', episode: 0, updatedTo: 0, playCount: 0 } : null);
    if (!meta?.id) return null;
    const ordered = Array.isArray(payload.aweme_list) ? payload.aweme_list
      : Array.isArray(payload.awemeList) ? payload.awemeList
        : Array.isArray(payload.item_list) ? payload.item_list
          : Array.isArray(payload.mix_list) ? payload.mix_list
            : Array.isArray(payload.collection_list) ? payload.collection_list
              : null;
    const items = [];
    const seen = new Set();
    const pushItem = (info, fallbackEpisode) => {
      if (!info?.id || seen.has(info.id)) return;
      seen.add(info.id);
      items.push({
        ...info,
        mix: info.mix || meta,
        episode: Number(info.episode || info.mix?.episode || fallbackEpisode || 0) || 0
      });
    };
    if (ordered) {
      ordered.forEach((item, index) => pushItem(normalizeMixListItem(item, meta), index + 1));
    } else {
      collectAwemeItems(payload).forEach((item, index) => pushItem(normalizeMixListItem(item, meta), index + 1));
      ingestPayload(payload).forEach((info, index) => pushItem(info, index + 1));
    }
    return {
      meta,
      items,
      cursor: Number(payload.cursor ?? payload.max_cursor ?? payload.min_cursor ?? 0) || 0,
      hasMore: Boolean(Number(payload.has_more ?? payload.hasMore ?? payload.has_more_aweme ?? 0))
    };
  }

  function parseJsonFragments(text) {
    const raw = asText(text);
    if (!raw) return [];
    try {
      return [JSON.parse(raw)];
    } catch (_) { /* try fragments */ }
    const out = [];
    if (raw.includes('\n')) {
      raw.split('\n').forEach((line) => {
        const piece = line.trim();
        if (!piece) return;
        try {
          out.push(JSON.parse(piece));
        } catch (_) { /* ignore bad line */ }
      });
      if (out.length) return out;
    }
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < raw.length; i += 1) {
      const ch = raw[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          try {
            out.push(JSON.parse(raw.slice(start, i + 1)));
          } catch (_) { /* ignore bad object */ }
          start = -1;
        }
      }
    }
    return out;
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
    let text = asText(value)
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
      .replace(/[. ]+$/g, '');
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(text)) text = '_' + text;
    return text || fallback || 'douyin-video';
  }

  function buildFilename(info, quality, style) {
    const title = sanitizeFilename(info?.title, '抖音视频');
    const author = info?.author ? sanitizeFilename(info.author, '').slice(0, 30) : '';
    const id = asText(info?.id);
    const label = sanitizeFilename(quality?.label || '视频', '视频');
    if (style === 'title') return title;
    const suffix = (style === 'title-author-id' ? [author, id] : style === 'detailed' ? [author, id, label] : [id, label]).filter(Boolean).join(' - ');
    const available = Math.max(1, 120 - suffix.length - 3);
    return [title.slice(0, available).replace(/[. ]+$/g, ''), suffix].filter(Boolean).join(' - ');
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
    parseMixId,
    isDouyinHost,
    isVideoPage,
    isAwemeApi,
    isMixApi,
    isNoiseApi,
    playUrlFromUri,
    unwrapPlayUrl,
    isLikelyAudioOnlyUrl,
    urlList,
    estimateQualityBytes,
    pickDownloadUrls,
    pickCover,
    scoreCoverUrl,
    isBadCoverUrl,
    isSuspiciousCoverUrl,
    isLikelyLowResCover,
    imageExtension,
    qualityFromMeta,
    buildQualities,
    isVideoAweme,
    extractMixMeta,
    normalizeMixListItem,
    summarizeMixPayload,
    normalizeAweme,
    collectAwemeItems,
    inspectCandidate,
    inspectPayload,
    extractRouterFromHtml,
    parseJsonFragments,
    ingestPayload,
    ingestMixPayload,
    sanitizeFilename,
    buildFilename,
    formatBytes,
    formatDuration,
    formatCount
  };
});
