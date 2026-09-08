/**
 * 抖音下载 — 页面内识别与取流（MAIN world）
 */
(function () {
  'use strict';
  if (window.__DOUYIN_DL_AGENT__) return;
  window.__DOUYIN_DL_AGENT__ = true;

  const PANEL = 'douyin-dl-panel';
  const AGENT = 'douyin-dl-agent';
  const parse = globalThis.DouyinDlParse;
  if (!parse) {
    console.warn('[DouyinDL-Agent] 缺少 DouyinDlParse');
    return;
  }

  const cache = new Map();
  const sessions = new Map();
  const cancelledBeforeStart = new Set();
  const earlyLogs = [];
  const apiHits = [];
  const PROGRESS_REPORT_INTERVAL_MS = 150;
  const STALL_MS = 30000;
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

  function remember(info) {
    if (!info?.id) return false;
    const existed = cache.has(info.id);
    cache.set(info.id, info);
    return !existed;
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

  function collectFromPlayer(id) {
    const urls = new Set();
    document.querySelectorAll('video').forEach((video) => {
      [video.currentSrc, video.src].forEach((value) => {
        if (/^https:\/\//i.test(value) && !/\.m3u8/i.test(value)) urls.add(value);
      });
    });
    document.querySelectorAll('.xgplayer, xg-video-container, [class*="xgplayer"]').forEach((el) => {
      const player = el.player || el.__player || el.xgPlayer;
      const source = player?.config?.url || player?.url;
      const list = Array.isArray(source) ? source : [source];
      list.forEach((value) => {
        const url = typeof value === 'string' ? value : (value?.src || value?.url);
        if (/^https:\/\//i.test(url) && !/\.m3u8/i.test(url)) urls.add(url);
      });
    });
    try {
      performance.getEntriesByType('resource').forEach((entry) => {
        if (/douyinvod|bytevod|douyincdn/i.test(entry.name) && /^https:\/\//i.test(entry.name)) {
          urls.add(entry.name);
        }
      });
    } catch (_) { /* ignore */ }
    if (!urls.size) return null;
    const title = (document.querySelector('[data-e2e="browse-video-desc"], [data-e2e="video-desc"], .video-info-detail')?.textContent || '').trim();
    const author = (document.querySelector('[data-e2e="feed-video-nickname"], [data-e2e="video-author"], .account-name')?.textContent || '').trim();
    const cover = document.querySelector('video')?.poster || '';
    log('播放器', '找到 ' + urls.size + ' 条地址');
    return {
      id,
      title: title || '抖音视频',
      author,
      cover: /^https:\/\//i.test(cover) ? cover : '',
      duration: 0,
      playCount: 0,
      createTime: 0,
      qualities: [{
        qn: 1,
        label: '页面播放',
        height: 0,
        bitrate: 0,
        size: 0,
        h265: false,
        urls: [...urls]
      }]
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
    const path = shortPath(url);
    if (!path || apiHits[apiHits.length - 1] === path) return;
    apiHits.push(path);
    if (apiHits.length > 30) apiHits.shift();
    log('接口', path);
  }

  function ingestResponse(url, payload) {
    noteApi(url);
    const count = ingest(payload, shortPath(url));
    if (!count) {
      const stats = parse.inspectPayload(payload);
      if (stats.raw) {
        log('接口', shortPath(url) + ' 有条目但无片源 ' + JSON.stringify(stats.inspected.slice(0, 3)));
      }
    }
  }

  function hookNetwork() {
    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function' && !nativeFetch.__dyDlHooked) {
      const hookedFetch = function hookedFetch(input, init) {
        const request = nativeFetch.call(this, input, init);
        try {
          const url = String(input?.url || input || '');
          if (parse.isAwemeApi(url) && !parse.isNoiseApi(url)) {
            request.then((res) => {
              res.clone().json().then((data) => ingestResponse(url, data)).catch((error) => {
                log('接口', shortPath(url) + ' JSON失败 ' + (error?.message || error));
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
          if (parse.isAwemeApi(url) && !parse.isNoiseApi(url)) {
            request.then((res) => {
              res.clone().json().then((data) => ingestResponse(url, data)).catch(() => {});
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
        return xhrOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.open.__dyDlHooked = true;
      XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function onLoad() {
          try {
            if (parse.isAwemeApi(this.__dyDlUrl) && !parse.isNoiseApi(this.__dyDlUrl) && this.responseText) {
              ingestResponse(this.__dyDlUrl, JSON.parse(this.responseText));
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
      cache: [...cache.keys()],
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

  async function resolveVideo(href) {
    hookNetwork();
    const target = href || location.href;
    const id = parse.parseAwemeId(target);
    log('识别', 'href=' + target);
    log('识别', 'awemeId=' + (id || '空'));
    if (!id) {
      dumpState('');
      throw new Error('请打开单个视频页后再下载');
    }
    readRouterData(true);
    if (cache.has(id)) {
      log('识别', '缓存命中 ' + id);
      return cache.get(id);
    }
    for (let i = 0; i < 10; i += 1) {
      await sleep(350);
      hookNetwork();
      readRouterData(i === 9);
      log('识别', '等待 ' + (i + 1) + '/10 缓存=' + (cache.size ? [...cache.keys()].join(',') : '空'));
      if (cache.has(id)) {
        log('识别', '第 ' + (i + 1) + ' 次等到 ' + id);
        return cache.get(id);
      }
    }
    const playerInfo = collectFromPlayer(id);
    if (playerInfo) {
      remember(playerInfo);
      log('识别', '改用播放器地址');
      return playerInfo;
    }
    dumpState(id);
    throw new Error('未识别到视频信息，请先播放当前视频或刷新页面');
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
        reject(new Error('请求超时，请刷新页面后重试'));
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
    return blob.slice(4, 8).arrayBuffer().then((buffer) => {
      const mark = String.fromCharCode(...new Uint8Array(buffer));
      if (mark !== 'ftyp') throw new Error('片源不是可保存的 MP4，请切换清晰度后重试');
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
          credentials: 'omit',
          referrer: 'https://www.douyin.com/',
          referrerPolicy: 'origin',
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
        const buf = await res.arrayBuffer();
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
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          reportProgress(session, {
            percent: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
            received,
            total
          }, onProgress, false);
        }
      } catch (error) {
        if (session.cancelled) throw new Error('下载已取消');
        if (session.paused || session.pauseEpoch !== pauseEpoch) {
          await waitWhilePaused(session);
          throwIfCancelled(session);
          continue;
        }
        throw error;
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
      const info = await resolveVideo(payload.href || location.href);
      const quality = info.qualities.find((item) => item.qn === payload.qn) || info.qualities[0];
      if (!quality?.urls?.length) throw new Error('当前清晰度没有可下载地址');
      const filename = parse.sanitizeFilename(info.title, '抖音视频') + '.mp4';
      sendProgress(session, 'download', 0);
      try {
        const blob = await fetchMedia(session, quality.urls, (progress) => {
          sendProgress(session, 'download', progress.percent, progress);
        });
        throwIfCancelled(session);
        await looksLikeMp4(blob);
        sendProgress(session, 'save', 100, { received: blob.size, total: blob.size });
        return { blob, filename, info, quality, jobId: session.jobId };
      } catch (error) {
        if (error?.message === '下载已取消') throw error;
        log('下载', '页内拉取失败，改浏览器直链：' + (error?.message || error));
        return { direct: true, urls: quality.urls, filename, info, quality, jobId: session.jobId };
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

  hookNetwork();
  readRouterData();
  watchLocation();

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.source !== PANEL) return;
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
        case 'RESOLVE_VIDEO':
          reply(id, { type: 'OK', data: { info: await resolveVideo(event.data.href) } });
          break;
        case 'START_DOWNLOAD':
          reply(id, { type: 'OK', data: await handleDownload(event.data) });
          break;
        case 'PAUSE_DOWNLOAD':
          pauseDownload(event.data.jobId || null);
          break;
        case 'RESUME_DOWNLOAD':
          resumeDownload(event.data.jobId || null);
          break;
        case 'CANCEL_DOWNLOAD':
          cancelDownload(event.data.jobId || null);
          break;
        default:
          reply(id, { type: 'ERR', error: '未知请求: ' + type });
      }
    } catch (error) {
      reply(id, { type: 'ERR', error: error?.message || String(error) });
    }
  });

  log('初始化', '页面代理已就绪');
})();
