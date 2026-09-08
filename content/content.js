(function () {
  'use strict';

  if (window.__DOUYIN_DL_INIT__) return;
  window.__DOUYIN_DL_INIT__ = true;

  const parse = globalThis.DouyinDlParse;
  const EXT = DownloaderKit.runtime.getApi();
  const PANEL = 'douyin-dl-panel';
  const AGENT = 'douyin-dl-agent';
  const HISTORY_KEY = 'douyinDlHistory_v1';
  const HISTORY_MAX = 50;

  const shell = DownloaderKit.shell.mount({
    title: '下载助手 抖音',
    idPrefix: 'douyin-dl',
    configUrl: 'https://download-config-hub.nutmeg-venus-6882.chatgpt.site/api/config/douyin',
    messageType: 'DOUYIN_DL_FETCH_JSON',
    cacheKey: 'douyin-dlRemoteContent_v1',
    ratingKey: 'douyin-dlStoreRating_v1',
    footer: {
      faqUrl: 'https://snowflake-hangdudu.github.io/douyin-downloader/faq.html',
      privacyUrl: 'https://snowflake-hangdudu.github.io/douyin-downloader/',
      email: 'hangdudu0@agent.qq.com',
      subject: '抖音下载助手反馈'
    },
    defaults: {
      notice: {
        enabled: true,
        title: '公告',
        pinned: ['当前只支持单个视频页。请先打开 /video/ 或带 modal_id 的播放页。'],
        recent: ['第一版：识别当前视频、选择清晰度、保存 MP4 和封面。'],
        knownIssues: [],
        roadmap: { feedback: [], upcoming: ['用户页批量下载'], planned: [] }
      },
      coop: {
        enabled: true,
        title: '开发合作',
        body: '接浏览器插件定制开发。\n邮箱：hangdudu0@agent.qq.com'
      },
      rating: { enabled: false, url: '', edge: '', chrome: '', firefox: '', minSuccess: 3 }
    },
    messages: {
      openPanel: 'DOUYIN_DL_OPEN_PANEL',
      openSheet: 'DOUYIN_DL_OPEN_SHEET'
    }
  });

  const ui = document.createElement('div');
  ui.className = 'dy-dl';
  ui.innerHTML = `
    <div class="dy-dl-video-card is-loading">
      <div class="dy-dl-cover-column">
        <div class="dy-dl-cover-wrap">
          <div class="dy-dl-sk-cover"></div>
          <img class="dy-dl-cover hidden" alt="">
          <div class="dy-dl-cover-ph hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <button type="button" class="dy-dl-cover-download" disabled>下载封面</button>
      </div>
      <div class="dy-dl-video-meta">
        <div class="dy-dl-video-sk">
          <span class="dy-dl-sk-line"></span>
          <span class="dy-dl-sk-line short"></span>
          <span class="dy-dl-sk-line shorter"></span>
        </div>
        <div class="dy-dl-video-content hidden">
          <div class="dy-dl-video-title"></div>
          <div class="dy-dl-video-author hidden"></div>
          <div class="dy-dl-video-sub"></div>
        </div>
      </div>
    </div>
    <div class="dy-dl-section">
      <div class="dy-dl-section-head">清晰度</div>
      <div class="dy-dl-quality-pills">
        <span class="dy-dl-pill loading">加载中</span>
      </div>
    </div>
    <div class="dy-dl-estimate hidden">预计大小 —</div>
    <button type="button" class="dy-dl-btn" disabled>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
      开始下载
    </button>
    <div class="dy-dl-job-list hidden"></div>
    <div class="dy-dl-status hidden"></div>
  `;
  shell.home.appendChild(ui);

  const cardEl = ui.querySelector('.dy-dl-video-card');
  const coverSk = ui.querySelector('.dy-dl-sk-cover');
  const coverImg = ui.querySelector('.dy-dl-cover');
  const coverPh = ui.querySelector('.dy-dl-cover-ph');
  const videoSk = ui.querySelector('.dy-dl-video-sk');
  const videoContent = ui.querySelector('.dy-dl-video-content');
  const titleEl = ui.querySelector('.dy-dl-video-title');
  const authorEl = ui.querySelector('.dy-dl-video-author');
  const subEl = ui.querySelector('.dy-dl-video-sub');
  const pillsEl = ui.querySelector('.dy-dl-quality-pills');
  const estimateEl = ui.querySelector('.dy-dl-estimate');
  const startBtn = ui.querySelector('.dy-dl-btn');
  const coverBtn = ui.querySelector('.dy-dl-cover-download');
  const jobListEl = ui.querySelector('.dy-dl-job-list');
  const statusEl = ui.querySelector('.dy-dl-status');

  let videoInfo = null;
  let selectedQn = 0;
  let reqId = 0;
  const pending = new Map();
  const activeJobs = new Map();

  function storageGet(keys) {
    return new Promise((resolve) => {
      try { EXT.storage.local.get(keys, (result) => resolve(result || {})); }
      catch (_) { resolve({}); }
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      try { EXT.storage.local.set(value, () => resolve()); }
      catch (_) { resolve(); }
    });
  }

  function agentCall(type, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = 'req-' + (++reqId);
      pending.set(id, { resolve, reject });
      window.postMessage({ source: PANEL, id, type, ...payload }, '*');
      const limit = timeoutMs === 0 ? 0 : (Number(timeoutMs) > 0 ? timeoutMs : 20000);
      if (limit > 0) {
        setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            reject(new Error('页面代理超时，请刷新页面重试'));
          }
        }, limit);
      }
    });
  }

  function agentSignal(type, extra) {
    window.postMessage({ source: PANEL, type, ...extra }, '*');
  }

  function setStatus(text, kind) {
    if (!text) {
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
      return;
    }
    statusEl.dataset.kind = kind || '';
    statusEl.textContent = text;
    statusEl.classList.remove('hidden');
  }

  function setVideoLoading(loading) {
    cardEl.classList.toggle('is-loading', loading);
    videoSk.classList.toggle('hidden', !loading);
    videoContent.classList.toggle('hidden', loading);
    if (loading) {
      coverSk.classList.remove('hidden');
      coverImg.classList.add('hidden');
      coverPh.classList.add('hidden');
    }
  }

  function currentQuality() {
    return videoInfo?.qualities?.find((item) => item.qn === selectedQn) || videoInfo?.qualities?.[0] || null;
  }

  function refreshEstimate() {
    const quality = currentQuality();
    if (!quality?.size) {
      estimateEl.classList.add('hidden');
      return;
    }
    estimateEl.textContent = '预计大小 ' + parse.formatBytes(quality.size);
    estimateEl.classList.remove('hidden');
  }

  function renderQualityPills(list) {
    pillsEl.replaceChildren();
    if (!list?.length) {
      const empty = document.createElement('span');
      empty.className = 'dy-dl-pill disabled';
      empty.textContent = '无可用清晰度';
      pillsEl.appendChild(empty);
      selectedQn = 0;
      return;
    }
    if (!list.some((item) => item.qn === selectedQn)) selectedQn = list[0].qn;
    list.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dy-dl-pill' + (item.qn === selectedQn ? ' active' : '');
      btn.textContent = item.label;
      btn.onclick = () => {
        selectedQn = item.qn;
        renderQualityPills(list);
        refreshEstimate();
      };
      pillsEl.appendChild(btn);
    });
  }

  function showCover(url) {
    if (!url) {
      coverPh.classList.remove('hidden');
      coverSk.classList.add('hidden');
      coverBtn.disabled = true;
      return;
    }
    coverImg.src = url;
    const ok = () => {
      coverImg.classList.remove('hidden');
      coverPh.classList.add('hidden');
      coverSk.classList.add('hidden');
    };
    const fail = () => {
      coverImg.classList.add('hidden');
      coverPh.classList.remove('hidden');
      coverSk.classList.add('hidden');
    };
    if (coverImg.complete) {
      coverImg.naturalWidth ? ok() : fail();
    } else {
      coverImg.onload = ok;
      coverImg.onerror = fail;
    }
    coverBtn.disabled = false;
  }

  function applyVideoInfo(info) {
    videoInfo = info;
    setVideoLoading(false);
    titleEl.textContent = info.title;
    if (info.author) {
      authorEl.textContent = info.author;
      authorEl.classList.remove('hidden');
    } else {
      authorEl.classList.add('hidden');
    }
    const parts = [];
    if (info.duration) parts.push(parse.formatDuration(info.duration));
    if (info.playCount) parts.push(parse.formatCount(info.playCount) + ' 播放');
    if (info.id) parts.push(info.id);
    subEl.textContent = parts.join(' · ') || '抖音视频';
    showCover(info.cover);
    renderQualityPills(info.qualities);
    refreshEstimate();
    startBtn.disabled = !info.qualities?.length || activeJobs.size > 0;
    setStatus('');
    shell.debug.log('识别', info.id + ' · ' + info.qualities.map((item) => item.label).join(', '));
  }

  function showEmpty(message) {
    videoInfo = null;
    setVideoLoading(false);
    titleEl.textContent = message || '请打开单个视频页';
    authorEl.classList.add('hidden');
    subEl.textContent = '支持 /video/ 页面，以及推荐流里点开的当前视频';
    showCover('');
    pillsEl.replaceChildren();
    const tip = document.createElement('span');
    tip.className = 'dy-dl-pill disabled';
    tip.textContent = '未识别到视频';
    pillsEl.appendChild(tip);
    estimateEl.classList.add('hidden');
    startBtn.disabled = true;
    coverBtn.disabled = true;
  }

  function revealDebug() {
    const el = document.getElementById('douyin-dl-debug');
    if (el) el.open = true;
  }

  async function loadVideoInfo() {
    const href = location.href;
    const awemeId = parse.parseAwemeId(href);
    shell.debug.log('面板', '识别开始 href=' + href);
    shell.debug.log('面板', 'awemeId=' + (awemeId || '空'));
    setVideoLoading(true);
    startBtn.disabled = true;
    coverBtn.disabled = true;
    pillsEl.replaceChildren();
    const loading = document.createElement('span');
    loading.className = 'dy-dl-pill loading';
    loading.textContent = '加载中';
    pillsEl.appendChild(loading);
    if (!awemeId) {
      showEmpty('请打开单个视频页后再下载');
      shell.debug.log('面板', '当前不是单个视频页');
      return;
    }
    try {
      const result = await agentCall('RESOLVE_VIDEO', { href }, 25000);
      if (href !== location.href) return;
      applyVideoInfo(result.info);
    } catch (error) {
      if (href !== location.href) return;
      shell.debug.log('错误', error.message || error);
      try {
        shell.debug.log('兜底', '读取分享页 ' + awemeId);
        const share = await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_FETCH_SHARE', awemeId });
        if (share?.ok && share.info) {
          applyVideoInfo(share.info);
          shell.debug.log('兜底', '分享页识别成功');
          return;
        }
        shell.debug.log('兜底', share?.error || '分享页无数据');
      } catch (shareError) {
        shell.debug.log('兜底失败', shareError.message || shareError);
      }
      showEmpty(error.message || '识别失败');
      setStatus(error.message || '识别失败', 'error');
      revealDebug();
      try {
        const dump = await agentCall('DUMP_STATE', { awemeId }, 5000);
        shell.debug.log('快照', dump?.state || dump);
      } catch (dumpError) {
        shell.debug.log('快照失败', dumpError.message || dumpError);
      }
    }
  }

  function mountJobCard(job) {
    const el = document.createElement('div');
    el.className = 'dy-dl-progress';
    el.innerHTML = `
      <div class="dy-dl-progress-meta">
        <span class="dy-dl-progress-title"></span>
        <span class="dy-dl-progress-q"></span>
      </div>
      <div class="dy-dl-progress-head">
        <span class="dy-dl-job-phase">准备下载</span>
        <span class="dy-dl-job-pct">0%</span>
      </div>
      <div class="dy-dl-progress-track"><div class="dy-dl-progress-bar"></div></div>
      <div class="dy-dl-progress-actions">
        <button type="button" class="dy-dl-action-btn dy-dl-job-pause">暂停</button>
        <button type="button" class="dy-dl-action-btn danger dy-dl-job-cancel">取消</button>
      </div>
    `;
    el.querySelector('.dy-dl-progress-title').textContent = job.info?.title || '视频';
    el.querySelector('.dy-dl-progress-q').textContent = job.label || '';
    const pauseBtn = el.querySelector('.dy-dl-job-pause');
    const cancelBtn = el.querySelector('.dy-dl-job-cancel');
    const bar = el.querySelector('.dy-dl-progress-bar');
    pauseBtn.onclick = () => {
      const current = activeJobs.get(job.jobId);
      if (!current) return;
      if (current.paused) {
        agentSignal('RESUME_DOWNLOAD', { jobId: job.jobId });
        current.paused = false;
        pauseBtn.textContent = '暂停';
        bar.classList.remove('paused');
      } else {
        agentSignal('PAUSE_DOWNLOAD', { jobId: job.jobId });
      }
    };
    cancelBtn.onclick = () => {
      job.cancelRequested = true;
      agentSignal('CANCEL_DOWNLOAD', { jobId: job.jobId });
    };
    job.cardEl = el;
    jobListEl.appendChild(el);
    jobListEl.classList.remove('hidden');
  }

  function updateProgress(step, percent, received, total, jobId) {
    const job = activeJobs.get(jobId);
    const el = job?.cardEl;
    if (!el) return;
    const phaseEl = el.querySelector('.dy-dl-job-phase');
    const pctEl = el.querySelector('.dy-dl-job-pct');
    const bar = el.querySelector('.dy-dl-progress-bar');
    const pauseBtn = el.querySelector('.dy-dl-job-pause');
    if (step === 'paused') {
      job.paused = true;
      pauseBtn.textContent = '继续';
      phaseEl.textContent = '已暂停';
      bar.classList.add('paused');
      return;
    }
    if (job.paused) {
      job.paused = false;
      pauseBtn.textContent = '暂停';
      bar.classList.remove('paused');
    }
    const labels = { download: '下载视频', save: '保存到本地' };
    phaseEl.textContent = labels[step] || '下载中…';
    const recv = Number(received) || 0;
    const tot = Number(total) || 0;
    const pct = tot > 0 ? Math.min(100, Math.round((recv / tot) * 100)) : Math.max(0, Number(percent) || 0);
    if (tot > 0) {
      pctEl.textContent = parse.formatBytes(recv) + ' / ' + parse.formatBytes(tot);
      bar.style.width = pct + '%';
      bar.classList.remove('indeterminate');
    } else if (pct > 0) {
      pctEl.textContent = pct + '%';
      bar.style.width = pct + '%';
      bar.classList.remove('indeterminate');
    } else {
      pctEl.textContent = '';
      bar.classList.add('indeterminate');
    }
  }

  async function downloadBlob(blob, filename, shouldCancel) {
    if (shouldCancel()) throw new Error('下载已取消');
    if (!blob?.size || !filename) throw new Error('保存数据不可用，请刷新页面后重试');
    const url = URL.createObjectURL(blob);
    let downloadId;
    try {
      const started = await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_SAVE_MEDIA', url, filename });
      if (!started?.ok) throw new Error(started?.error || '无法创建浏览器下载');
      downloadId = started.downloadId;
      let lastBytes = -1;
      let lastAt = Date.now();
      for (;;) {
        if (shouldCancel()) {
          await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_CANCEL_MEDIA', downloadId });
          throw new Error('下载已取消');
        }
        const result = await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_MEDIA_STATE', downloadId });
        if (!result?.ok) throw new Error(result?.error || '无法确认保存结果');
        if (result.state === 'complete') return downloadId;
        if (result.state === 'interrupted') throw new Error('浏览器保存失败：' + (result.error || '下载中断'));
        if (Number(result.bytesReceived || 0) !== lastBytes) {
          lastBytes = Number(result.bytesReceived || 0);
          lastAt = Date.now();
        } else if (Date.now() - lastAt > 180000) {
          await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_CANCEL_MEDIA', downloadId });
          throw new Error('浏览器保存长时间无进展，已停止');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function addHistory(entry) {
    try {
      const stored = await storageGet(HISTORY_KEY);
      const items = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
      const next = [entry, ...items.filter((item) => item.id !== entry.id || item.qn !== entry.qn)].slice(0, HISTORY_MAX);
      await storageSet({ [HISTORY_KEY]: next });
    } catch (_) { /* ignore */ }
  }

  async function startDownload() {
    if (!videoInfo || activeJobs.size) return;
    const quality = currentQuality();
    if (!quality) return;
    const jobId = 'job-' + Date.now();
    const job = {
      jobId,
      info: videoInfo,
      qn: quality.qn,
      label: quality.label,
      cancelRequested: false,
      paused: false
    };
    activeJobs.set(jobId, job);
    mountJobCard(job);
    startBtn.disabled = true;
    setStatus('');
    try {
      const result = await agentCall('START_DOWNLOAD', {
        href: location.href,
        qn: quality.qn,
        jobId
      }, 0);
      if (job.cancelRequested) throw new Error('下载已取消');
      const filename = result.filename || (parse.sanitizeFilename(videoInfo.title, '抖音视频') + '.mp4');
      if (result.direct) {
        updateProgress('save', 10, 0, 0, jobId);
        const direct = await EXT.runtime.sendMessage({
          type: 'DOUYIN_DL_SAVE_DIRECT',
          urls: result.urls,
          filename
        });
        if (!direct?.ok) throw new Error(direct?.error || '浏览器直链下载失败');
        updateProgress('save', 100, 0, 0, jobId);
      } else {
        updateProgress('save', 95, 0, 0, jobId);
        await downloadBlob(result.blob, filename, () => job.cancelRequested);
        updateProgress('save', 100, result.blob.size, result.blob.size, jobId);
      }
      await addHistory({
        id: videoInfo.id,
        title: videoInfo.title,
        author: videoInfo.author,
        qn: quality.qn,
        label: quality.label,
        href: location.href,
        at: Date.now()
      });
      shell.noteSuccess();
      setStatus('已保存到浏览器下载目录', 'ok');
      shell.debug.log('完成', result.filename);
    } catch (error) {
      setStatus(error.message || '下载失败', 'error');
      shell.debug.log('错误', error.message || error);
    } finally {
      job.cardEl?.remove();
      activeJobs.delete(jobId);
      if (!activeJobs.size) jobListEl.classList.add('hidden');
      startBtn.disabled = !videoInfo?.qualities?.length;
    }
  }

  async function downloadCover() {
    if (!videoInfo?.cover) return;
    const filename = parse.sanitizeFilename(videoInfo.title, 'douyin-cover') + '.jpg';
    const result = await EXT.runtime.sendMessage({
      type: 'DOUYIN_DL_DOWNLOAD_COVER',
      url: videoInfo.cover,
      filename
    }).catch((error) => ({ ok: false, error: error.message }));
    if (result?.ok) setStatus('封面已开始保存', 'ok');
    else setStatus(result?.error || '封面下载失败', 'error');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== AGENT) return;
    const { id, type, step, msg, data, error } = event.data;
    if (type === 'LOG') {
      shell.debug.log(step, msg);
      return;
    }
    if (type === 'LOCATION') {
      if (event.data.href) loadVideoInfo();
      return;
    }
    if (type === 'PROGRESS') {
      updateProgress(event.data.step, event.data.percent, event.data.received, event.data.total, event.data.jobId);
      return;
    }
    if (id && pending.has(id)) {
      const waiter = pending.get(id);
      pending.delete(id);
      if (type === 'OK') waiter.resolve(data);
      else waiter.reject(new Error(error || '请求失败'));
    }
  });

  EXT.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'DOUYIN_DL_GET_INFO') return undefined;
    const id = parse.parseAwemeId(location.href);
    if (!id && !videoInfo) {
      respond({ ok: false, error: '请打开单个视频页' });
      return undefined;
    }
    respond({
      ok: true,
      data: {
        info: videoInfo ? {
          title: videoInfo.title,
          author: videoInfo.author,
          cover: videoInfo.cover,
          sub: (currentQuality()?.label || 'MP4') + (videoInfo.id ? ' · ' + videoInfo.id : '')
        } : {
          title: '正在识别当前视频',
          sub: id
        }
      }
    });
    return undefined;
  });

  startBtn.addEventListener('click', () => {
    startDownload().catch((error) => setStatus(error.message || '下载失败', 'error'));
  });
  coverBtn.addEventListener('click', () => {
    downloadCover().catch((error) => setStatus(error.message || '封面下载失败', 'error'));
  });
  agentCall('FLUSH_LOGS', {}, 3000).catch(() => {});
  loadVideoInfo();
  shell.debug.log('面板已就绪');
})();
