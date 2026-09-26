/**
 * 抖音下载 — 页面内识别与取流（MAIN world）
 */
(function () {
  'use strict';
  if (window.__DOUYIN_DL_AGENT_READY__) return;

  const PANEL = 'douyin-dl-panel';
  const AGENT = 'douyin-dl-agent';
  const parse = globalThis.DouyinDlParse;
  if (!parse) {
    console.warn('[DouyinDL-Agent] 缺少 DouyinDlParse');
    return;
  }

  const cache = new Map();
  const mixCaches = new Map();
  const sessions = new Map();
  const cancelledBeforeStart = new Set();
  const earlyLogs = [];
  const apiHits = [];
  const mixRequestTemplates = new Map();
  let lastSignedApiUrl = '';
  let signedApiUrl = '';
  let lastActiveAwemeId = '';
  const PROGRESS_REPORT_INTERVAL_MS = 150;
  const STALL_MS = 30000;
  const API_FETCH_TIMEOUT_MS = 8000;
  const PAGE_GLOBALS = [
    '_ROUTER_DATA',
    '__NEXT_DATA__',
    '__UNIVERSAL_DATA_FOR_REHYDRATION__',
    '_SSR_HYDRATED_DATA',
    '__INITIAL_STATE__',
    '_RENDER_DATA'
  ];

  function reply(id, payload) {
    window.postMessage({ source: AGENT, id, ...payload }, '*');
  }

  function shortPath(url) {
    try {
      const parsed = new URL(String(url), location.href);
      return parsed.pathname.slice(0, 80);
    } catch (_) {
      return String(url || '').slice(0, 80);
    }
  }

  function log(step, msg) {
    const line = '[' + step + '] ' + msg;
    earlyLogs.push(line);
    if (earlyLogs.length > 80) earlyLogs.shift();
    reply(null, { type: 'LOG', step, msg });
    console.log('[DouyinDL-Agent]', step, msg);
  }

  function cacheVideo(info) {
    if (!info?.id) return false;
    const existed = cache.has(info.id);
    cache.delete(info.id);
    cache.set(info.id, info);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return !existed;
  }

  function remember(info) {
    const added = cacheVideo(info);
    if (info?.mix?.id) rememberMixSeed(info);
    return added;
  }

  function rememberMixSeed(info) {
    const mixId = info?.mix?.id;
    if (!mixId) return;
    let entry = mixCaches.get(mixId);
    if (!entry) {
      entry = {
        meta: { ...info.mix },
        items: [],
        cursor: 0,
        hasMore: true
      };
      mixCaches.set(mixId, entry);
    } else {
      entry.meta = { ...entry.meta, ...info.mix };
    }
    const index = entry.items.findIndex((item) => item.id === info.id);
    const row = {
      ...info,
      episode: Number(info.episode || info.mix?.episode || 0) || 0
    };
    if (index >= 0) entry.items[index] = { ...entry.items[index], ...row };
    else entry.items.push(row);
  }

  function rememberMix(mixData) {
    if (!mixData?.meta?.id) return 0;
    const mixId = mixData.meta.id;
    let entry = mixCaches.get(mixId);
    if (!entry) {
      entry = { meta: mixData.meta, items: [], cursor: 0, hasMore: false };
      mixCaches.set(mixId, entry);
    }
    entry.meta = { ...entry.meta, ...mixData.meta };
    const seen = new Set(entry.items.map((item) => item.id));
    let added = 0;
    (mixData.items || []).forEach((item) => {
      if (!item?.id) return;
      cacheVideo(item);
      if (seen.has(item.id)) {
        const index = entry.items.findIndex((row) => row.id === item.id);
        if (index >= 0) entry.items[index] = { ...entry.items[index], ...item };
        return;
      }
      seen.add(item.id);
      entry.items.push(item);
      added += 1;
    });
    if (mixData.cursor != null) entry.cursor = Number(mixData.cursor) || 0;
    if (mixData.hasMore != null) entry.hasMore = Boolean(mixData.hasMore);
    return added;
  }

  function ingest(payload, source) {
    if (!payload) return 0;
    const infos = parse.ingestPayload(payload);
    let added = 0;
    infos.forEach((info) => {
      if (remember(info)) added += 1;
    });
    if (added || infos.length) {
      log('摄入', (source || 'page') + ' +' + added + '/' + infos.length + ' 缓存=' + cache.size + (infos[0] ? ' id=' + infos.map((item) => item.id).slice(0, 4).join(',') : ''));
    }
    return infos.length;
  }

  function ingestMix(payload, sourceUrl) {
    const mixData = parse.ingestMixPayload(payload, sourceUrl);
    if (!mixData?.meta?.id) return 0;
    const added = rememberMix(mixData);
    log('合集', (mixData.meta.name || mixData.meta.id) + ' +' + added + '/' + mixData.items.length + ' cursor=' + mixData.cursor + ' more=' + Number(mixData.hasMore));
    return mixData.items.length;
  }

  function readJsonScript(id) {
    const node = document.getElementById(id);
    if (!node?.textContent) return null;
    try {
      return JSON.parse(decodeURIComponent(node.textContent));
    } catch (_) {
      try { return JSON.parse(node.textContent); } catch { return null; }
    }
  }

  function readInlineScripts() {
    const nodes = document.querySelectorAll('script');
    for (const node of nodes) {
      const text = node.textContent || '';
      if (text.length < 40 || text.length > 2000000) continue;
      if (text.includes('window._ROUTER_DATA')) {
        const data = parse.extractRouterFromHtml('window._ROUTER_DATA=' + text.slice(text.indexOf('window._ROUTER_DATA')) + '</script>');
        if (data) ingest(data, 'inline-_ROUTER_DATA');
      }
    }
  }

  function visibleVideos() {
    return [...document.querySelectorAll('video')].filter((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    });
  }

  function pickActiveVideo(videos) {
    const scored = videos.map((video) => {
      const rect = video.getBoundingClientRect();
      const area = rect.width * rect.height;
      const inModal = Boolean(video.closest(
        '[data-e2e="feed-active-video"], [data-e2e="feed-video"], [data-e2e="aweme-detail"], [role="dialog"], [class*="Modal"], [class*="modal"], [class*="Overlay"], [class*="overlay"], [class*="Detail"]'
      ));
      const urls = [...new Set([video.currentSrc, video.src])].filter((url) => /^https:\/\//i.test(url || '') && !/\.m3u8/i.test(url));
      const container = video.closest('[data-e2e="feed-active-video"], [data-e2e="feed-video"], [data-e2e="aweme-detail"]');
      const title = container?.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"]')?.textContent?.trim() || '';
      return { video, area, inModal, urls, title };
    }).filter((item) => item.urls.length);
    scored.sort((a, b) => (Number(b.inModal) - Number(a.inModal)) || (b.area - a.area));
    return scored[0] || null;
  }

  function pushAwemeId(candidates, id) {
    const text = String(id || '').trim();
    if (/^\d{5,}$/.test(text) && !candidates.includes(text)) candidates.push(text);
  }

  function rememberActiveAwemeId(id, source) {
    const text = String(id || '').trim();
    if (!/^\d{5,}$/.test(text) || text === lastActiveAwemeId) return;
    lastActiveAwemeId = text;
    if (source) log('识别', '活跃作品 ' + text + ' · ' + source);
  }

  function rememberActiveFromApi(url, payload) {
    try {
      const parsed = new URL(String(url || ''), location.href);
      const fromQuery = parsed.searchParams.get('aweme_id')
        || parsed.searchParams.get('awemeId')
        || parsed.searchParams.get('item_id')
        || parsed.searchParams.get('itemId');
      if (/^\d{5,}$/.test(fromQuery || '')) {
        rememberActiveAwemeId(fromQuery, shortPath(url));
        return;
      }
    } catch (_) { /* ignore */ }
    if (!payload || typeof payload !== 'object') return;
    const fromBody = asText(payload.aweme_id || payload.awemeId || payload.item_id || payload.itemId);
    if (/^\d{5,}$/.test(fromBody)) rememberActiveAwemeId(fromBody, shortPath(url));
  }

  function awemeIdFromHistory() {
    try {
      const raw = JSON.stringify(history.state || {});
      const match = raw.match(/(?:modal_id|aweme_id|awemeId)["':=\s]+(\d{10,})/);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }

  function detectPageAwemeId(href) {
    const candidates = [];
    const target = href || location.href;
    pushAwemeId(candidates, parse.parseAwemeId(target));
    pushAwemeId(candidates, awemeIdFromHistory());
    if (candidates.length) return candidates[0];

    document.querySelectorAll('meta[property="og:url"], meta[name="og:url"]').forEach((node) => {
      pushAwemeId(candidates, parse.parseAwemeId(node.content));
    });
    pushAwemeId(candidates, parse.parseAwemeId(document.querySelector('link[rel="canonical"]')?.href));

    document.querySelectorAll(
      '[data-e2e="feed-active-video"], [data-e2e="feed-video"], [data-e2e="aweme-detail"], [data-e2e="video-player-inline"]'
    ).forEach((scope) => {
      scope.querySelectorAll('a[href]').forEach((node) => {
        pushAwemeId(candidates, parse.parseAwemeId(node.href || node.getAttribute('href')));
      });
    });

    document.querySelectorAll('a[href*="modal_id="], a[href*="/video/"], a[href*="/note/"]').forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pushAwemeId(candidates, parse.parseAwemeId(node.href || node.getAttribute('href')));
    });

    if (lastActiveAwemeId) pushAwemeId(candidates, lastActiveAwemeId);

    if (document.querySelector('video') && cache.size) {
      [...cache.entries()].reverse().some(([, info]) => {
        if (!info?.qualities?.length) return false;
        pushAwemeId(candidates, info.id);
        return true;
      });
    }

    for (const info of cache.values()) {
      if (info?.qualities?.length) pushAwemeId(candidates, info.id);
    }

    if (lastActiveAwemeId && candidates.includes(lastActiveAwemeId)) return lastActiveAwemeId;
    return candidates[0] || '';
  }

  function collectFromPlayer(id, href) {
    const pageId = id || parse.parseAwemeId(href || location.href) || lastActiveAwemeId || detectPageAwemeId(href);
    if (!pageId) return null;
    const videos = visibleVideos();
    if (!videos.length) return null;
    const picked = pickActiveVideo(videos);
    if (!picked) return null;
    if (videos.length > 1 && !picked.inModal && !picked.title && !pageId) return null;
    const title = picked.title || document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"]')?.textContent?.trim() || '抖音视频';
    return {
      id: pageId,
      title,
      author: '',
      cover: pageCoverForAweme(pageId) || normalizeCoverUrl(picked.video.poster),
      duration: Number(picked.video.duration) * 1000 || 0,
      qualities: [{ qn: 1, label: '页面播放', urls: picked.urls, size: 0, h265: false }]
    };
  }

  function readRouterData(verbose) {
    const before = cache.size;
    PAGE_GLOBALS.forEach((name) => ingest(window[name], name));
    ingest(readJsonScript('RENDER_DATA'), 'RENDER_DATA');
    ingest(readJsonScript('_RENDER_DATA'), '_RENDER_DATA');
    readInlineScripts();
    if (verbose) {
      const router = window._ROUTER_DATA;
      log('页面', [
        'href=' + location.href,
        'router=' + (router ? Object.keys(router).slice(0, 8).join(',') : '无'),
        'loader=' + (router?.loaderData ? Object.keys(router.loaderData).slice(0, 6).join(',') : '无'),
        'globals=' + PAGE_GLOBALS.filter((name) => window[name]).join(',') || '无',
        'render=' + (document.getElementById('RENDER_DATA')?.textContent?.length || 0),
        'videoEl=' + document.querySelectorAll('video').length,
        'cache=' + ([...cache.keys()].join(',') || '空')
      ].join(' · '));
    }
    return cache.size - before;
  }

  function noteApi(url) {
    rememberApiUrl(url);
    const path = shortPath(url);
    if (!path || apiHits[apiHits.length - 1] === path) return;
    apiHits.push(path);
    if (apiHits.length > 30) apiHits.shift();
    log('接口', path);
  }

  function rememberApiUrl(url) {
    const text = String(url || '');
    if (!parse.isAwemeApi(text)) return;
    lastSignedApiUrl = text;
    if (/[?&](?:msToken|a_bogus)=/i.test(text)) signedApiUrl = text;
    if (!(/\/(?:mix|series)\//i.test(text) || /[?&](?:mix_id|series_id)=\d+/i.test(text))) return;
    try {
      const parsed = new URL(text, location.href);
      const mixId = parsed.searchParams.get('mix_id') || parsed.searchParams.get('mixId')
        || parsed.searchParams.get('series_id') || parsed.searchParams.get('seriesId');
      if (mixId) mixRequestTemplates.set(mixId, parsed.toString());
    } catch (_) { /* ignore */ }
  }

  function buildCollectionFetchUrls(mixId, cursor) {
    const out = [];
    const seen = new Set();
    const push = (raw) => {
      const text = String(raw || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    };
    const tpl = mixRequestTemplates.get(mixId) || mixRequestTemplates.get(String(mixId));
    const sources = [tpl, signedApiUrl, lastSignedApiUrl].filter(Boolean);
    const paths = tpl && /\/series\//i.test(tpl)
      ? ['/aweme/v1/web/series/aweme/', '/aweme/v1/web/mix/aweme/']
      : ['/aweme/v1/web/series/aweme/', '/aweme/v1/web/mix/aweme/'];
    const skipKeys = new Set(['mix_id', 'mixId', 'series_id', 'seriesId', 'cursor', 'max_cursor', 'count']);
    const applyCommon = (url) => {
      url.searchParams.set('series_id', mixId);
      url.searchParams.set('mix_id', mixId);
      url.searchParams.set('cursor', String(cursor || 0));
      url.searchParams.set('count', '20');
      url.searchParams.set('device_platform', url.searchParams.get('device_platform') || 'webapp');
      url.searchParams.set('aid', url.searchParams.get('aid') || '6383');
      url.searchParams.set('channel', url.searchParams.get('channel') || 'channel_pc_web');
      return url;
    };
    sources.forEach((source) => {
      paths.forEach((path) => {
        try {
          const base = new URL(source, location.href);
          const url = applyCommon(new URL(location.origin + path));
          base.searchParams.forEach((value, key) => {
            if (!skipKeys.has(key)) url.searchParams.set(key, value);
          });
          push(url.toString());
        } catch (_) { /* ignore */ }
      });
    });
    if (!sources.length) {
      paths.forEach((path) => {
        push(applyCommon(new URL(location.origin + path)).toString());
      });
    }
    return out.slice(0, 4);
  }

  function detectMixMetaFromDom() {
    const meta = { id: '', name: '合集', cover: '', episode: 0, updatedTo: 0, playCount: 0 };
    document.querySelectorAll('a[href*="mix_id="], a[href*="/collection/"], a[href*="/mix/"]').forEach((node) => {
      const href = node.href || node.getAttribute('href') || '';
      const mixId = parse.parseMixId(href);
      if (mixId) meta.id = mixId;
    });
    const badgePool = document.querySelectorAll('button, a, [role="tab"], [data-e2e], [class*="mix"], [class*="Mix"]');
    const badge = [...badgePool].find((node) => {
      if ((node.textContent || '').length > 160) return false;
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      return text.includes('合集') && /更新至?\s*\d+/.test(text) && text.length <= 120;
    });
    if (badge) {
      const text = String(badge.textContent || '').replace(/\s+/g, ' ').trim();
      meta.name = asText(text.match(/合集[·•\s—-]+([^|]+)/)?.[1]) || meta.name;
      meta.updatedTo = Number(text.match(/更新至?\s*(\d+)/)?.[1] || 0) || 0;
    }
    for (const info of cache.values()) {
      if (!info?.mix?.id) continue;
      if (!meta.id) meta.id = info.mix.id;
      meta.name = info.mix.name || meta.name;
      meta.updatedTo = meta.updatedTo || Number(info.mix.updatedTo) || 0;
      meta.episode = meta.episode || Number(info.mix.episode) || 0;
    }
    return meta;
  }

  function coverFromCardElement(card) {
    if (!card) return '';
    let best = '';
    let bestScore = -999;
    card.querySelectorAll('img').forEach((img) => {
      const url = normalizeCoverUrl(img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src'));
      if (!url || parse.isBadCoverUrl(url)) return;
      const score = parse.scoreCoverUrl(url);
      if (score > bestScore) {
        bestScore = score;
        best = url;
      }
    });
    return best;
  }

  function awemeLinksIn(node) {
    if (!node?.querySelectorAll) return [];
    return [...node.querySelectorAll('a[href*="modal_id="], a[href*="/video/"], a[href*="/note/"]')];
  }

  function tightAwemeScope(node) {
    let scope = node;
    let parent = node.parentElement;
    const ownId = parse.parseAwemeId(node.href || node.getAttribute?.('href') || '');
    while (parent && parent !== document.body && parent !== document.documentElement) {
      const ids = new Set();
      awemeLinksIn(parent).forEach((link) => {
        const id = parse.parseAwemeId(link.href || link.getAttribute('href') || '');
        if (id) ids.add(id);
      });
      if (ids.size > 1) break;
      if (ownId && ids.size === 1 && !ids.has(ownId)) break;
      scope = parent;
      parent = parent.parentElement;
    }
    return scope;
  }

  let rowCoverCache = null;
  let rowCoverCacheId = '';

  function invalidateRowCovers() {
    rowCoverCache = null;
    rowCoverCacheId = '';
  }

  function rowCoverMap() {
    const playing = playingAwemeId();
    if (rowCoverCache && rowCoverCacheId === playing) return rowCoverCache;
    rowCoverCacheId = playing;
    const map = new Map();
    document.querySelectorAll('a[href*="modal_id="], a[href*="/video/"], a[href*="/note/"]').forEach((node) => {
      const id = parse.parseAwemeId(node.href || node.getAttribute('href') || '');
      if (!id) return;
      const cover = coverFromCardElement(tightAwemeScope(node)) || coverFromCardElement(node);
      if (!cover) return;
      const prev = map.get(id);
      if (!prev || parse.scoreCoverUrl(cover) > parse.scoreCoverUrl(prev)) map.set(id, cover);
    });
    rowCoverCache = map;
    return map;
  }

  function rowCoverForAweme(awemeId) {
    return rowCoverMap().get(String(awemeId || '')) || '';
  }

  function collectionSidebarOpen() {
    const root = document.getElementById('douyin-dl-root');
    let count = 0;
    document.querySelectorAll('a[href*="modal_id="], a[href*="/video/"]').forEach((node) => {
      if (root?.contains(node)) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 16 || rect.left < window.innerWidth * 0.45) return;
      count += 1;
    });
    return count >= 3;
  }

  function clickCollectionTab() {
    const blocked = document.getElementById('douyin-dl-root');
    const nodes = document.querySelectorAll('button, [role="tab"], [data-e2e]');
    for (const node of nodes) {
      if (blocked?.contains(node)) continue;
      const text = String(node.textContent || '').replace(/\s+/g, '').trim();
      if (text !== '合集' && !/^合集[·•]/.test(text)) continue;
      if (text.length > 16) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8 || rect.left < window.innerWidth * 0.4) continue;
      node.click();
      log('合集', '已打开右侧合集标签');
      return true;
    }
    return false;
  }

  function collectMixFromDom(mixId, meta) {
    const rows = [];
    const seen = new Set();
    const pushRow = (id, title, episode, card) => {
      if (!/^\d{5,}$/.test(String(id || '')) || seen.has(id)) return;
      seen.add(id);
      const domCover = coverFromCardElement(tightAwemeScope(card || node)) || coverFromCardElement(node) || rowCoverForAweme(id);
      const cached = cache.get(id);
      rows.push(cached ? {
        ...cached,
        cover: domCover || cached.cover,
        mix: cached.mix || meta,
        episode: episode || cached.episode || 0
      } : {
        id: String(id),
        title: asText(title) || '抖音视频',
        author: '',
        cover: domCover,
        duration: 0,
        qualities: [],
        mix: meta,
        episode: Number(episode) || 0
      });
    };
    const nodeSet = new Set();
    [
      'a[href*="modal_id="]',
      'a[href*="/video/"]',
      'a[href*="/note/"]',
      '[data-e2e="mix-detail-page"] a[href]',
      '[data-e2e="user-collection-list"] a[href]',
      '[class*="MixList"] a[href]',
      '[class*="mix-list"] a[href]'
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => nodeSet.add(node));
    });
    nodeSet.forEach((node) => {
      const href = node.href || node.getAttribute('href') || '';
      const id = parse.parseAwemeId(href);
      if (!id) return;
      const card = node.closest('li, [class*="item"], [class*="Item"], [class*="card"], [class*="Card"]') || node.parentElement;
      const text = String(card?.textContent || node.textContent || '').replace(/\s+/g, ' ').trim();
      const episode = Number(text.match(/第(\d+)集/)?.[1] || text.match(/^(\d+)$/)?.[1] || 0) || 0;
      pushRow(id, text.slice(0, 120), episode, card);
    });
    document.querySelectorAll('a[href*="modal_id="]').forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.left < innerWidth * 0.42) return;
      const href = node.href || node.getAttribute('href') || '';
      const id = parse.parseAwemeId(href);
      if (!id) return;
      const card = node.closest('li, [class*="item"], [class*="Item"], [class*="card"], [class*="Card"]') || node.parentElement;
      const text = String(card?.textContent || node.textContent || '').replace(/\s+/g, ' ').trim();
      const episode = Number(text.match(/第(\d+)集/)?.[1] || text.match(/^(\d+)\D/)?.[1] || text.match(/\b(\d{1,2})\b/)?.[1] || 0) || 0;
      pushRow(id, text.slice(0, 120), episode, card);
    });
    if (rows.length) {
      log('合集', 'DOM 读取 ' + rows.length + ' 条 mixId=' + mixId);
    }
    return rows;
  }

  function seedCurrentAwemeIntoMix(mixId, meta, hintAwemeId) {
    const awemeId = asText(hintAwemeId) || parse.parseAwemeId(location.href) || lastActiveAwemeId;
    if (!/^\d{5,}$/.test(awemeId)) return 0;
    const mixMeta = {
      id: mixId,
      name: meta?.name || '合集',
      cover: meta?.cover || '',
      episode: Number(meta?.episode) || 0,
      updatedTo: Number(meta?.updatedTo) || 0,
      playCount: Number(meta?.playCount) || 0
    };
    let row = cache.get(awemeId);
    if (!row) {
      row = collectFromPlayer(awemeId, location.href);
      if (row) remember(row);
    }
    if (!row) return 0;
    const episode = Number(row.episode || row.mix?.episode || mixMeta.episode || 0) || 0;
    const added = rememberMix({
      meta: { ...mixMeta, name: mixMeta.name || row.mix?.name || row.title || '合集' },
      items: [{ ...row, mix: { ...mixMeta, name: mixMeta.name || row.mix?.name || '合集' }, episode }],
      cursor: 0,
      hasMore: Boolean(mixMeta.updatedTo > 1)
    });
    if (added) log('合集', '当前播放 +' + added + ' id=' + awemeId);
    return added;
  }

  function asText(value) {
    return String(value == null ? '' : value).trim();
  }

  function seedMixFromDom(mixId, meta) {
    const domItems = collectMixFromDom(mixId, meta);
    if (!domItems.length) return 0;
    return rememberMix({
      meta: meta || { id: mixId, name: '合集', cover: '', episode: 0, updatedTo: 0, playCount: 0 },
      items: domItems,
      cursor: 0,
      hasMore: Boolean(meta?.updatedTo && domItems.length < meta.updatedTo)
    });
  }

  function ingestParsedPayload(url, payload) {
    rememberActiveFromApi(url, payload);
    if (parse.isMixApi(url) || /\/(?:mix|series)\/aweme\//i.test(String(url || ''))) {
      ingestMix(payload, url);
    }
    const count = ingest(payload, shortPath(url));
    if (!count) {
      const stats = parse.inspectPayload(payload);
      if (stats.raw) {
        log('接口', shortPath(url) + ' 有条目但无片源 ' + JSON.stringify(stats.inspected.slice(0, 3)));
      }
    }
  }

  function ingestResponse(url, payload) {
    noteApi(url);
    ingestParsedPayload(url, payload);
  }

  function ingestTextResponse(url, text) {
    noteApi(url);
    const payloads = parse.parseJsonFragments(text);
    if (!payloads.length) {
      log('接口', shortPath(url) + ' JSON失败 无法解析响应');
      return;
    }
    if (payloads.length > 1) {
      log('接口', shortPath(url) + ' 分段=' + payloads.length);
    }
    payloads.forEach((payload) => ingestParsedPayload(url, payload));
  }

  function hookNetwork() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function' && !nativeFetch.__dyDlHooked) {
      const hookedFetch = function hookedFetch(input, init) {
        const request = nativeFetch.call(this, input, init);
        try {
          const url = String(input?.url || input || '');
          rememberApiUrl(url);
          if (parse.isAwemeApi(url) && !parse.isNoiseApi(url)) {
            request.then((res) => {
              res.clone().text().then((text) => ingestTextResponse(url, text)).catch((error) => {
                log('接口', shortPath(url) + ' 读取失败 ' + (error?.message || error));
              });
            }).catch(() => {});
          }
        } catch (_) { /* ignore */ }
        return request;
      };
      hookedFetch.__dyDlHooked = true;
      window.fetch = hookedFetch;
      log('挂钩', 'fetch 已挂上');
    } else if (typeof window.fetch === 'function' && !window.fetch.__dyDlHooked) {
      log('挂钩', '页面替换了 fetch，重新挂上');
      window.__DOUYIN_DL_NET__ = false;
      const current = window.fetch;
      window.fetch = function (input, init) {
        const request = current.call(this, input, init);
        try {
          const url = String(input?.url || input || '');
          rememberApiUrl(url);
          if (parse.isAwemeApi(url) && !parse.isNoiseApi(url)) {
            request.then((res) => {
              res.clone().text().then((text) => ingestTextResponse(url, text)).catch(() => {});
            }).catch(() => {});
          }
        } catch (_) { /* ignore */ }
        return request;
      };
      window.fetch.__dyDlHooked = true;
    }

    if (!XMLHttpRequest.prototype.open.__dyDlHooked) {
      const xhrOpen = XMLHttpRequest.prototype.open;
      const xhrSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__dyDlUrl = url;
        rememberApiUrl(url);
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.open.__dyDlHooked = true;
      XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function onLoad() {
          try {
            if (parse.isAwemeApi(this.__dyDlUrl) && !parse.isNoiseApi(this.__dyDlUrl) && this.responseText) {
              ingestTextResponse(this.__dyDlUrl, this.responseText);
            }
          } catch (_) { /* ignore */ }
        });
        return xhrSend.apply(this, arguments);
      };
      log('挂钩', 'XHR 已挂上');
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function dumpState(id) {
    const router = window._ROUTER_DATA;
    const renderLen = document.getElementById('RENDER_DATA')?.textContent?.length || 0;
    const inspect = router ? parse.inspectPayload(router) : { raw: 0, ok: 0, inspected: [] };
    const state = {
      href: location.href,
      id: id || parse.parseAwemeId(location.href),
      mixId: parse.parseMixId(location.href) || cache.get(id || parse.parseAwemeId(location.href))?.mix?.id || '',
      cache: [...cache.keys()],
      mixes: [...mixCaches.entries()].map(([mixId, entry]) => ({ mixId, count: entry.items.length, hasMore: entry.hasMore })),
      apis: apiHits.slice(-12),
      routerKeys: router ? Object.keys(router).slice(0, 10) : [],
      loaderKeys: router?.loaderData ? Object.keys(router.loaderData).slice(0, 8) : [],
      globals: PAGE_GLOBALS.filter((name) => Boolean(window[name])),
      renderLen,
      videoEl: document.querySelectorAll('video').length,
      inspect
    };
    log('快照', JSON.stringify(state));
    return state;
  }

  function normalizeCoverUrl(value) {
    let url = String(value || '').trim();
    if (!url) return '';
    if (url.startsWith('//')) url = 'https:' + url;
    url = url.replace(/^http:\/\//i, 'https://');
    return /^https:\/\//i.test(url) ? url : '';
  }

  function pushCoverCandidate(candidates, seen, value, bonus = 0) {
    const url = normalizeCoverUrl(value);
    if (!url || seen.has(url) || parse.isBadCoverUrl(url)) return;
    seen.add(url);
    candidates.push({ url, score: parse.scoreCoverUrl(url) + bonus });
  }

  function pushCoverImage(candidates, seen, img, bonus = 0) {
    if (!img) return;
    const rect = img.getBoundingClientRect?.() || { width: 0, height: 0 };
    if (rect.width > 0 && rect.height > 0) {
      if (rect.width < 56 || rect.height < 32) return;
      const ratio = rect.width / rect.height;
      if (ratio > 2.8 || ratio < 0.35) return;
    }
    pushCoverCandidate(
      candidates,
      seen,
      img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src'),
      bonus
    );
  }

  function pickBestCover(candidates) {
    if (!candidates.length) return '';
    return [...candidates].sort((a, b) => {
      const left = typeof a === 'string' ? { url: a, score: parse.scoreCoverUrl(a) } : a;
      const right = typeof b === 'string' ? { url: b, score: parse.scoreCoverUrl(b) } : b;
      return right.score - left.score;
    })[0]?.url || '';
  }

  function collectMatchedCardCovers(awemeId, candidates, seen) {
    if (!/^\d{5,}$/.test(String(awemeId || ''))) return;
    const cover = rowCoverForAweme(awemeId);
    if (cover) pushCoverCandidate(candidates, seen, cover, 100);
  }

  function collectActiveModalCovers(candidates, seen) {
    document.querySelectorAll(
      '[data-e2e="feed-active-video"], [data-e2e="aweme-detail"], [data-e2e="video-player-inline"], [role="dialog"]'
    ).forEach((scope) => {
      scope.querySelectorAll('img').forEach((img) => pushCoverImage(candidates, seen, img, 40));
    });
  }

  function pageCoverStrictForAweme(awemeId) {
    const candidates = [];
    const seen = new Set();
    collectMatchedCardCovers(awemeId, candidates, seen);
    return pickBestCover(candidates);
  }

  function pageCoverForAweme(awemeId) {
    const strict = pageCoverStrictForAweme(awemeId);
    if (strict) return strict;
    const candidates = [];
    const seen = new Set();
    collectActiveModalCovers(candidates, seen);
    if (candidates.length) return pickBestCover(candidates);
    [
      document.querySelector('meta[property="og:image"]')?.content,
      document.querySelector('meta[name="og:image"]')?.content,
      document.querySelector('meta[property="twitter:image"]')?.content
    ].forEach((value) => pushCoverCandidate(candidates, seen, value));
    return pickBestCover(candidates);
  }

  function pageCoverFallback(awemeId) {
    const picked = pickActiveVideo(visibleVideos());
    if (picked?.inModal) {
      const poster = normalizeCoverUrl(picked.video.poster);
      if (poster && !parse.isBadCoverUrl(poster)) return poster;
    }
    return pageCoverForAweme(awemeId);
  }

  function pageOgCover() {
    return normalizeCoverUrl(
      document.querySelector('meta[property="og:image"]')?.content
      || document.querySelector('meta[property="og:image:url"]')?.content
    );
  }

  function activePlayerPoster() {
    const picked = pickActiveVideo(visibleVideos());
    const video = picked?.video;
    if (!video) return '';
    const poster = normalizeCoverUrl(video.poster);
    if (poster && !parse.isBadCoverUrl(poster)) return poster;
    const box = video.closest('.xgplayer, [data-e2e="feed-active-video"], [data-e2e="feed-video"]') || video.parentElement;
    if (!box || document.getElementById('douyin-dl-root')?.contains(box)) return '';
    const styled = box.querySelector('.xgplayer-poster, [class*="poster"]');
    const bg = String(styled?.style?.backgroundImage || '');
    const fromBg = bg.match(/url\(["']?(https:[^"')]+)/i);
    const url = normalizeCoverUrl(fromBg?.[1] || '');
    return url && !parse.isBadCoverUrl(url) ? url : '';
  }

  function ensureCover(info) {
    if (!info) return info;
    const apiCover = normalizeCoverUrl(info.cover);
    const apiOk = Boolean(apiCover && !parse.isBadCoverUrl(apiCover));
    const playing = playingAwemeId();
    const isCurrent = !playing || !info.id || String(info.id) === String(playing);
    const poster = activePlayerPoster();
    const og = pageOgCover();
    if (!isCurrent) {
      // 其它集不用当前播放器海报，也不要用侧栏里扫到的同一张大图盖掉接口封面。
      if (apiOk && apiCover !== poster) {
        info.cover = apiCover;
        return info;
      }
      const rowCover = rowCoverForAweme(info.id);
      info.cover = rowCover && rowCover !== poster && !parse.isBadCoverUrl(rowCover) ? rowCover : '';
      return info;
    }
    // 合集上下滑时 og:image 停在打开页的第一张。接口封面若是另一张，就用接口的。
    if (apiOk && apiCover !== og) {
      info.cover = apiCover;
      return info;
    }
    if (poster && poster !== og) {
      info.cover = poster;
      return info;
    }
    info.cover = apiOk ? apiCover : '';
    return info;
  }

  function buildDetailFetchUrls(id) {
    const out = [];
    const seen = new Set();
    const push = (raw) => {
      const text = String(raw || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    };
    const sources = [lastSignedApiUrl].filter(Boolean);
    sources.forEach((source) => {
      try {
        const base = new URL(source, location.href);
        const url = new URL(location.origin + '/aweme/v1/web/aweme/detail/');
        base.searchParams.forEach((value, key) => {
          if (!['aweme_id', 'awemeId', 'item_id', 'itemId'].includes(key)) {
            url.searchParams.set(key, value);
          }
        });
        url.searchParams.set('aweme_id', id);
        url.searchParams.set('device_platform', url.searchParams.get('device_platform') || 'webapp');
        url.searchParams.set('aid', url.searchParams.get('aid') || '6383');
        url.searchParams.set('channel', url.searchParams.get('channel') || 'channel_pc_web');
        push(url.toString());
      } catch (_) { /* ignore */ }
    });
    const basic = new URLSearchParams({
      aweme_id: id,
      device_platform: 'webapp',
      aid: '6383',
      channel: 'channel_pc_web'
    });
    if (!sources.length) {
      push(location.origin + '/aweme/v1/web/aweme/detail/?' + basic.toString());
    }
    return out.slice(0, 2);
  }

  async function fetchJsonText(url) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(API_FETCH_TIMEOUT_MS)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }

  async function fetchAwemeDetail(id) {
    const urls = buildDetailFetchUrls(id);
    let lastError;
    for (const url of urls) {
      log('识别', '直拉 ' + shortPath(url));
      try {
        const text = await fetchJsonText(url);
        ingestTextResponse(url, text);
        if (cache.get(id)) return cache.get(id);
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return cache.get(id) || null;
  }

  function playingAwemeId() {
    return parse.parseAwemeId(location.href) || lastActiveAwemeId || detectPageAwemeId(location.href) || '';
  }

  function tryPlayerResolve(id, target) {
    const playing = playingAwemeId();
    if (id && playing && String(id) !== String(playing)) return null;
    const playerInfo = collectFromPlayer(id, target);
    if (!playerInfo) return null;
    if (id && playerInfo.id && String(playerInfo.id) !== String(id)) return null;
    remember(playerInfo);
    log('识别', '改用播放器地址');
    return ensureCover(playerInfo);
  }

  async function resolveVideo(href, hintId) {
    hookNetwork();
    const target = href || location.href;
    if (!parse.isDouyinHost(target)) throw new Error('不支持的作品地址');
    const hinted = /^\d{5,}$/.test(String(hintId || '')) ? String(hintId) : '';
    const id = parse.parseAwemeId(target) || hinted || lastActiveAwemeId || detectPageAwemeId(target);
    log('识别', 'href=' + target);
    log('识别', 'awemeId=' + (id || '空'));
    if (!id) {
      dumpState('');
      throw new Error('请打开单个视频页后再下载');
    }
    rememberActiveAwemeId(id, 'resolve');
    readRouterData(true);
    const playing = playingAwemeId();
    if (playing && id !== playing) {
      try {
        const fetched = await fetchAwemeDetail(id);
        if (fetched?.qualities?.length && fetched.id === id) {
          log('识别', '非当前集，详情直拉 ' + id);
          return ensureCover(fetched);
        }
      } catch (error) {
        log('识别', '非当前集直拉失败 ' + (error?.message || error));
      }
      if (cache.has(id) && cache.get(id)?.qualities?.length) return ensureCover(cache.get(id));
      throw new Error('这一集还没有片源。请先在合集里点开该视频播放几秒，或刷新列表后再试');
    }
    if (cache.has(id)) {
      log('识别', '缓存命中 ' + id);
      return ensureCover(cache.get(id));
    }
    let playerInfo = tryPlayerResolve(id, target);
    if (playerInfo) return playerInfo;
    for (let i = 0; i < 6; i += 1) {
      await sleep(300);
      hookNetwork();
      if (i === 2 || i === 5) readRouterData(false);
      log('识别', '等待 ' + (i + 1) + '/6 缓存=' + (cache.size ? [...cache.keys()].join(',') : '空'));
      if (cache.has(id)) {
        log('识别', '第 ' + (i + 1) + ' 次等到 ' + id);
        return ensureCover(cache.get(id));
      }
      playerInfo = tryPlayerResolve(id, target);
      if (playerInfo) return playerInfo;
      if (i === 2) {
        try {
          const fetched = await fetchAwemeDetail(id);
          if (fetched) {
            log('识别', '详情直拉命中 ' + id);
            return ensureCover(fetched);
          }
        } catch (error) {
          log('识别', '详情直拉失败 ' + (error?.message || error));
        }
      }
    }
    try {
      const fetched = await fetchAwemeDetail(id);
      if (fetched) {
        log('识别', '详情直拉命中 ' + id);
        return ensureCover(fetched);
      }
    } catch (error) {
      log('识别', '详情直拉失败 ' + (error?.message || error));
    }
    playerInfo = tryPlayerResolve(id, target);
    if (playerInfo) return playerInfo;
    dumpState(id);
    throw new Error('未识别到视频信息，请先播放当前视频或刷新页面');
  }

  function resolveMixId(href, mixId) {
    if (mixId && /^\d{5,}$/.test(String(mixId))) return String(mixId);
    const fromHref = parse.parseMixId(href || location.href);
    if (fromHref) return fromHref;
    const awemeId = parse.parseAwemeId(href || location.href) || lastActiveAwemeId;
    if (awemeId && cache.get(awemeId)?.mix?.id) return cache.get(awemeId).mix.id;
    for (const info of cache.values()) {
      if (info.mix?.id) return info.mix.id;
    }
    const domMeta = detectMixMetaFromDom();
    return domMeta.id || '';
  }

  async function fetchMixPage(mixId, cursor) {
    const urls = buildCollectionFetchUrls(mixId, cursor);
    let lastError;
    let lastSummary = '';
    for (const url of urls) {
      log('合集', '直拉 ' + shortPath(url));
      try {
        const text = await fetchJsonText(url);
        ingestTextResponse(url, text);
        const payloads = parse.parseJsonFragments(text);
        let mixData = null;
        payloads.forEach((payload) => {
          lastSummary = parse.summarizeMixPayload(payload);
          const parsed = parse.ingestMixPayload(payload, url);
          if (parsed?.items?.length && (!mixData || parsed.items.length > mixData.items.length)) {
            mixData = parsed;
          } else if (!mixData && parsed) {
            mixData = parsed;
          }
        });
        if (mixData?.items?.length) return mixData;
      } catch (error) {
        lastError = error;
        log('合集', shortPath(url) + ' 失败 ' + (error?.message || error));
      }
    }
    const cached = snapshotMix(mixId);
    if (cached.items.length) {
      log('合集', '直拉失败，沿用缓存 ' + cached.items.length + ' 集');
      return {
        meta: cached.meta,
        items: cached.items,
        cursor: cached.cursor,
        hasMore: cached.hasMore
      };
    }
    if (lastSummary) log('合集', '响应 ' + lastSummary);
    throw lastError || new Error('合集接口无数据' + (lastSummary ? '（' + lastSummary + '）' : ''));
  }

  function snapshotMix(mixId) {
    const entry = mixCaches.get(mixId);
    if (!entry) {
      return {
        mixId,
        title: '合集',
        items: [],
        cursor: 0,
        hasMore: false,
        hint: ''
      };
    }
    const items = entry.items
      .map((item) => ensureCover({ ...item }))
      .sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0) || String(a.id).localeCompare(String(b.id)));
    return {
      mixId,
      title: entry.meta?.name || '合集',
      meta: entry.meta,
      items,
      cursor: entry.cursor || 0,
      hasMore: Boolean(entry.hasMore),
      hint: ''
    };
  }

  async function paginateMix(mixId, snapshot, maxPages) {
    let current = snapshot;
    let guard = 0;
    const limit = Number(maxPages) > 0 ? Number(maxPages) : 30;
    const targetTotal = Number(current.meta?.updatedTo) || 0;
    while (guard < limit) {
      const needMore = current.hasMore || (targetTotal > 0 && current.items.length < targetTotal);
      if (!needMore) break;
      const before = current.items.length;
      try {
        await fetchMixPage(mixId, current.cursor);
      } catch (error) {
        log('合集', '分页失败 ' + (error?.message || error));
        break;
      }
      current = snapshotMix(mixId);
      guard += 1;
      log('合集', '分页 ' + guard + '/' + limit + ' · 累计 ' + current.items.length + ' 集 · more=' + Number(current.hasMore));
      if (current.items.length === before && !current.hasMore) break;
    }
    return current;
  }

  function resetMixCacheIfIncomplete(mixId) {
    const entry = mixCaches.get(mixId);
    if (!entry) return;
    const target = Number(entry.meta?.updatedTo) || 0;
    if (target > 0 && entry.items.length > 0 && entry.items.length < target) {
      log('合集', '缓存不完整 ' + entry.items.length + '/' + target + '，重新拉取');
      mixCaches.delete(mixId);
    }
  }

  async function resolveMix(href, mixId, options) {
    hookNetwork();
    readRouterData(false);
    const domMeta = detectMixMetaFromDom();
    const id = resolveMixId(href, mixId || domMeta.id);
    log('合集', 'resolve mixId=' + (id || '空'));
    if (!id) throw new Error('当前作品不属于合集，或尚未读到合集信息');

    invalidateRowCovers();
    if (options?.fetchAll || options?.force) resetMixCacheIfIncomplete(id);

    const mixMeta = {
      id,
      name: domMeta.name || '合集',
      cover: domMeta.cover || '',
      episode: domMeta.episode || 0,
      updatedTo: domMeta.updatedTo || 0,
      playCount: domMeta.playCount || 0
    };
    readRouterData(false);
    seedCurrentAwemeIntoMix(id, mixMeta, options?.awemeId);
    let snapshot = snapshotMix(id);
    if (!snapshot.meta?.name || snapshot.meta.name === '合集') {
      snapshot.meta = { ...mixMeta, ...snapshot.meta, id, name: mixMeta.name || snapshot.meta?.name || '合集' };
    }

    const shouldFetch = Boolean(options?.force || options?.fetchAll || snapshot.items.length < 2);
    if (shouldFetch) {
      log('合集', '主动请求合集接口 mixId=' + id);
      try {
        await fetchMixPage(id, 0);
        snapshot = snapshotMix(id);
      } catch (error) {
        log('合集', '直拉失败 ' + (error?.message || error));
      }
      const pageLimit = Number(options?.maxPages) > 0 ? Number(options.maxPages) : 8;
      snapshot = await paginateMix(id, snapshot, pageLimit);
    }

    const expected = Number(snapshot.meta?.updatedTo) || 0;
    const shortList = snapshot.items.length <= 1 || (expected > 1 && snapshot.items.length < Math.min(expected, 2));
    if (shortList && clickCollectionTab()) {
      await sleep(700);
      invalidateRowCovers();
      readRouterData(false);
      try {
        await fetchMixPage(id, 0);
        snapshot = await paginateMix(id, snapshotMix(id), Number(options?.maxPages) > 0 ? Number(options.maxPages) : 8);
      } catch (error) {
        log('合集', '打开合集后仍未拉到 ' + (error?.message || error));
      }
    }

    if (snapshot.items.length <= 1) {
      seedMixFromDom(id, snapshot.meta || mixMeta);
      snapshot = snapshotMix(id);
    }

    snapshot.sidebarOpen = collectionSidebarOpen();
    const expectedTotal = Number(snapshot.meta?.updatedTo) || 0;
    const listShort = !snapshot.sidebarOpen
      || snapshot.items.length <= 1
      || snapshot.hasMore
      || (expectedTotal > 0 && snapshot.items.length < expectedTotal);
    if (!snapshot.items.length) snapshot.hint = '';
    else if (listShort && snapshot.hasMore) snapshot.hint = '列表尚未完整，可点「继续加载」。';
    else if (!listShort) snapshot.hint = '勾选合集视频后将依次下载；下载期间请保持页面打开。';
    else snapshot.hint = '';
    log('合集', snapshot.title + ' · ' + snapshot.items.length + ' 集');
    return snapshot;
  }

  async function loadMoreMix(mixId, cursor) {
    const id = resolveMixId('', mixId);
    if (!id) throw new Error('缺少合集 ID');
    try {
      await fetchMixPage(id, cursor || mixCaches.get(id)?.cursor || 0);
    } catch (error) {
      log('合集', '加载更多失败 ' + (error?.message || error));
    }
    return snapshotMix(id);
  }

  function mediaCredentials(url) {
    try {
      const host = new URL(url, location.href).hostname;
      // 站内 play 接口需要登录态；CDN 若带 cookie 会撞上 ACAO:* 的 CORS。
      return /(^|\.)(douyin|iesdouyin)\.com$/i.test(host) ? 'include' : 'omit';
    } catch (_) {
      return 'omit';
    }
  }

  function createSession(jobId) {
    const id = jobId || ('job-' + Date.now());
    if (cancelledBeforeStart.has(id)) {
      cancelledBeforeStart.delete(id);
      const cancelled = {
        jobId: id,
        cancelled: true,
        paused: false,
        pauseEpoch: 0,
        controllers: {},
        lastProgress: { percent: 0, received: 0, total: 0 }
      };
      sessions.set(id, cancelled);
      return cancelled;
    }
    const session = {
      jobId: id,
      cancelled: false,
      paused: false,
      pauseEpoch: 0,
      pauseWait: null,
      controllers: {},
      progressAt: 0,
      lastProgress: { percent: 0, received: 0, total: 0 }
    };
    sessions.set(id, session);
    return session;
  }

  function destroySession(jobId) {
    sessions.delete(jobId);
  }

  function abortSession(session) {
    Object.values(session.controllers || {}).forEach((controller) => {
      try { controller.abort(); } catch { /* ignore */ }
    });
  }

  function sendProgress(session, step, percent, extra) {
    window.postMessage({
      source: AGENT,
      type: 'PROGRESS',
      jobId: session.jobId,
      step,
      percent,
      received: extra?.received || 0,
      total: extra?.total || 0
    }, '*');
  }

  function pauseDownload(jobId) {
    const targets = jobId ? [sessions.get(jobId)].filter(Boolean) : [...sessions.values()];
    targets.forEach((session) => {
      if (session.cancelled || session.paused) return;
      session.paused = true;
      session.pauseEpoch += 1;
      sendProgress(session, 'paused', session.lastProgress.percent || 0, session.lastProgress);
      abortSession(session);
    });
  }

  function resumeDownload(jobId) {
    const targets = jobId ? [sessions.get(jobId)].filter(Boolean) : [...sessions.values()];
    targets.forEach((session) => {
      if (session.cancelled || !session.paused) return;
      session.paused = false;
      if (session.pauseWait) {
        session.pauseWait.resolve();
        session.pauseWait = null;
      }
    });
  }

  function cancelDownload(jobId) {
    if (jobId && !sessions.has(jobId)) cancelledBeforeStart.add(jobId);
    const targets = jobId ? [sessions.get(jobId)].filter(Boolean) : [...sessions.values()];
    targets.forEach((session) => {
      session.cancelled = true;
      session.paused = false;
      if (session.pauseWait) {
        session.pauseWait.resolve();
        session.pauseWait = null;
      }
      abortSession(session);
    });
  }

  function waitWhilePaused(session) {
    if (!session.paused || session.cancelled) return Promise.resolve();
    if (!session.pauseWait) {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      session.pauseWait = { resolve, promise };
    }
    return session.pauseWait.promise;
  }

  function throwIfCancelled(session) {
    if (session.cancelled) throw new Error('下载已取消');
  }

  function withStallTimeout(promise, controller, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try { controller?.abort(); } catch { /* ignore */ }
        reject(new Error('下载停滞超时，请刷新页面后重试'));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function reportProgress(session, progress, onProgress, force) {
    session.lastProgress = progress;
    const now = performance.now();
    if (!force && now - session.progressAt < PROGRESS_REPORT_INTERVAL_MS) return;
    session.progressAt = now;
    onProgress?.(progress);
  }

  function looksLikeMp4(blob) {
    if (!blob || blob.size < 10240) throw new Error('片源过小，可能被拒绝访问，请刷新后重试');
    return blob.slice(0, Math.min(blob.size, 262144)).arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const mark = String.fromCharCode(bytes[4] || 0, bytes[5] || 0, bytes[6] || 0, bytes[7] || 0);
      if (mark !== 'ftyp') throw new Error('片源不是可保存的 MP4，请切换清晰度后重试');
      let hasVideo = false;
      for (let i = 0; i + 3 < bytes.length; i += 1) {
        if (bytes[i] === 0x76 && bytes[i + 1] === 0x69 && bytes[i + 2] === 0x64 && bytes[i + 3] === 0x65) {
          hasVideo = true;
          break;
        }
      }
      if (!hasVideo) throw new Error('片源似乎只有音频，请切换其他清晰度后重试');
    });
  }

  async function fetchOne(session, url, onProgress) {
    const chunks = [];
    let received = 0;
    let total = 0;

    while (true) {
      await waitWhilePaused(session);
      throwIfCancelled(session);
      const pauseEpoch = session.pauseEpoch;
      const controller = new AbortController();
      session.controllers.default = controller;
      const headers = {};
      if (received > 0) headers.Range = 'bytes=' + received + '-';

      let res;
      try {
        res = await withStallTimeout(fetch(url, {
          credentials: mediaCredentials(url),
          referrer: 'https://www.douyin.com/',
          referrerPolicy: 'strict-origin-when-cross-origin',
          headers,
          signal: controller.signal
        }), controller, STALL_MS);
      } catch (error) {
        if (session.cancelled) throw new Error('下载已取消');
        if (session.paused || session.pauseEpoch !== pauseEpoch) {
          await waitWhilePaused(session);
          throwIfCancelled(session);
          continue;
        }
        throw error;
      }

      if (!res.ok && !(received > 0 && res.status === 206)) {
        throw new Error('HTTP ' + res.status);
      }
      const ctype = String(res.headers.get('Content-Type') || '').toLowerCase();
      if (/text\/html|application\/json/.test(ctype)) {
        throw new Error('片源返回了错误页面，请刷新后重试');
      }
      if (received > 0 && res.status === 200) {
        chunks.length = 0;
        received = 0;
      }

      const length = Number(res.headers.get('Content-Length') || 0);
      const range = res.headers.get('Content-Range') || '';
      const rangeTotal = Number((range.match(/\/(\d+)/) || [])[1] || 0);
      if (rangeTotal > 0) total = rangeTotal;
      else if (length > 0) total = received + length;

      if (!res.body) {
        const buf = await withStallTimeout(res.arrayBuffer(), controller, STALL_MS);
        received += buf.byteLength;
        chunks.push(buf);
        reportProgress(session, {
          percent: total ? Math.round((received / total) * 100) : 0,
          received,
          total
        }, onProgress, true);
        break;
      }

      const reader = res.body.getReader();
      let needResume = false;
      try {
        while (true) {
          throwIfCancelled(session);
          let readResult;
          try {
            readResult = await withStallTimeout(reader.read(), controller, STALL_MS);
          } catch (error) {
            if (session.cancelled) throw new Error('下载已取消');
            if (session.paused || session.pauseEpoch !== pauseEpoch) {
              needResume = true;
              break;
            }
            throw error;
          }
          const { done, value } = readResult;
          if (done) {
            if (session.paused || session.pauseEpoch !== pauseEpoch) needResume = true;
            break;
          }
          chunks.push(value);
          received += value.byteLength;
          reportProgress(session, {
            percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
            received,
            total
          }, onProgress, false);
        }
      } finally {
        try { reader.releaseLock(); } catch { /* ignore */ }
        if (session.controllers.default === controller) delete session.controllers.default;
      }

      if (needResume) {
        await waitWhilePaused(session);
        throwIfCancelled(session);
        continue;
      }
      break;
    }

    reportProgress(session, {
      percent: 100,
      received,
      total: total || received
    }, onProgress, true);
    return new Blob(chunks, { type: 'video/mp4' });
  }

  function rankMediaUrl(url) {
    if (/douyinvod|bytevod|douyincdn/i.test(url)) return 3;
    if (/\/aweme\/v1\/play\//i.test(url)) return 1;
    return 2;
  }

  async function fetchMedia(session, urls, onProgress) {
    const list = [...urls].sort((a, b) => rankMediaUrl(b) - rankMediaUrl(a));
    let lastError;
    for (const url of list) {
      try {
        log('下载', '拉取 ' + shortPath(url));
        return await fetchOne(session, parse.unwrapPlayUrl(url), onProgress);
      } catch (error) {
        if (error?.message === '下载已取消') throw error;
        lastError = error;
        log('下载', '换备用地址：' + (error?.message || error));
      }
    }
    throw lastError || new Error('无可用视频地址');
  }

  async function handleDownload(payload) {
    const session = createSession(payload.jobId);
    try {
      throwIfCancelled(session);
      const requestedId = parse.parseAwemeId(payload.href || '') || '';
      const info = await resolveVideo(payload.href || location.href, requestedId);
      if (requestedId && info?.id && String(info.id) !== requestedId) {
        throw new Error('片源与所选视频不一致，请刷新列表后重试');
      }
      const quality = info.qualities.find((item) => item.qn === payload.qn) || info.qualities[0];
      const downloadUrls = parse.pickDownloadUrls(quality, info.qualities);
      if (!downloadUrls.length) throw new Error('当前清晰度没有可下载地址');
      if (quality?.h265 && downloadUrls.length > (quality.urls?.length || 0)) {
        log('下载', '高画质片源优先尝试兼容备用地址');
      }
      const filename = parse.sanitizeFilename(payload.filename || info.title, '抖音视频').replace(/\.mp4$/i, '') + '.mp4';
      sendProgress(session, 'download', 0);
      try {
        const blob = await fetchMedia(session, downloadUrls, (progress) => {
          sendProgress(session, 'download', progress.percent, progress);
        });
        throwIfCancelled(session);
        await looksLikeMp4(blob);
        sendProgress(session, 'save', 100, { received: blob.size, total: blob.size });
        return { blob, filename, info, quality, jobId: session.jobId };
      } catch (error) {
        if (error?.message === '下载已取消') throw error;
        log('下载', '页内拉取失败，改浏览器直链：' + (error?.message || error));
        return { direct: true, urls: downloadUrls, filename, info, quality, jobId: session.jobId };
      }
    } finally {
      destroySession(session.jobId);
    }
  }

  function notifyLocation() {
    window.postMessage({
      source: AGENT,
      type: 'LOCATION',
      href: location.href,
      awemeId: parse.parseAwemeId(location.href)
    }, '*');
  }

  function watchLocation() {
    let last = location.href;
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function () {
      const result = origPush.apply(this, arguments);
      queueMicrotask(() => {
        if (location.href !== last) {
          last = location.href;
          notifyLocation();
        }
      });
      return result;
    };
    history.replaceState = function () {
      const result = origReplace.apply(this, arguments);
      queueMicrotask(() => {
        if (location.href !== last) {
          last = location.href;
          notifyLocation();
        }
      });
      return result;
    };
    window.addEventListener('popstate', notifyLocation);
    setInterval(() => {
      if (location.href !== last) {
        last = location.href;
        notifyLocation();
      }
    }, 800);
  }

  function acceptPanelMessage(event) {
    if (!event?.data || event.data.source !== PANEL) return false;
    if (event.origin && event.origin !== location.origin) return false;
    return true;
  }

  window.addEventListener('message', async (event) => {
    if (!acceptPanelMessage(event)) return;
    const { id, type } = event.data;
    try {
      switch (type) {
        case 'FLUSH_LOGS':
          earlyLogs.forEach((line) => reply(null, { type: 'LOG', step: '缓冲', msg: line }));
          reply(id, { type: 'OK', data: { lines: earlyLogs.length } });
          break;
        case 'DUMP_STATE':
          reply(id, { type: 'OK', data: { state: dumpState(event.data.awemeId) } });
          break;
        case 'PING':
          reply(id, { type: 'OK', data: { ready: true, cache: cache.size, active: lastActiveAwemeId || '' } });
          break;
        case 'DETECT_AWEME_ID': {
          hookNetwork();
          const detectedId = parse.parseAwemeId(event.data.href || location.href)
            || lastActiveAwemeId
            || detectPageAwemeId(event.data.href);
          reply(id, { type: 'OK', data: { id: detectedId || '' } });
          break;
        }
        case 'RESOLVE_VIDEO': {
          const info = await resolveVideo(event.data.href, event.data.awemeId);
          reply(id, { type: 'OK', data: { info, awemeId: info?.id || '' } });
          break;
        }
        case 'RESOLVE_MIX':
          reply(id, {
            type: 'OK',
            data: await resolveMix(event.data.href, event.data.mixId, {
              force: Boolean(event.data.force),
              cursor: event.data.cursor,
              fetchAll: Boolean(event.data.fetchAll),
              maxPages: event.data.maxPages,
              awemeId: event.data.awemeId
            })
          });
          break;
        case 'LOAD_MIX_MORE':
          reply(id, { type: 'OK', data: await loadMoreMix(event.data.mixId, event.data.cursor) });
          break;
        case 'START_DOWNLOAD':
          reply(id, { type: 'OK', data: await handleDownload(event.data) });
          break;
        case 'PAUSE_DOWNLOAD':
          pauseDownload(event.data.jobId || null);
          reply(id, { type: 'OK', data: {} });
          break;
        case 'RESUME_DOWNLOAD':
          resumeDownload(event.data.jobId || null);
          reply(id, { type: 'OK', data: {} });
          break;
        case 'CANCEL_DOWNLOAD':
          cancelDownload(event.data.jobId || null);
          reply(id, { type: 'OK', data: {} });
          break;
        default:
          reply(id, { type: 'ERR', error: '未知请求: ' + type });
      }
    } catch (error) {
      reply(id, { type: 'ERR', error: error?.message || String(error) });
    }
  });

  window.__DOUYIN_DL_AGENT__ = true;
  window.__DOUYIN_DL_AGENT_READY__ = true;

  try {
    hookNetwork();
  } catch (error) {
    log('初始化', '挂钩失败 ' + (error?.message || error));
  }
  queueMicrotask(() => {
    try {
      readRouterData();
      watchLocation();
    } catch (error) {
      log('初始化', '页面数据读取失败 ' + (error?.message || error));
    }
  });

  log('初始化', '页面代理已就绪');
})();
