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
  const THEME_KEY = 'douyinDlTheme_v1';
  const THEMES = [
    { id: 'douyin', name: '默认' },
    { id: 'tokyo-love', name: '东爱主题' },
    { id: 'manchester-sea', name: '海边的曼彻斯特' },
    { id: 'chinese-odyssey', name: '大话西游' }
  ];
  const FILENAME = globalThis.DouyinDlFilename;
  const SETTINGS = globalThis.DouyinDlSettings;
  let filenameSettings = SETTINGS.cloneDefaults();
  let selectedTheme = 'douyin';
  const client = DouyinDownloadClient.create({ send: (message) => EXT.runtime.sendMessage(message) });
  let loadGeneration = 0;
  const settingsStore = SETTINGS.create({ get: storageGet, set: storageSet });
  let settingsReady = Promise.resolve();

  const shell = DownloaderKit.shell.mount({
    title: '抖音视频下载助手',
    idPrefix: 'douyin-dl',
    theme: 'douyin',
    iconUrl: EXT.runtime.getURL('icons/icon128.png') + '?r=3',
    configUrl: 'http://124.222.62.190:8081/api/config/douyin',
    messageType: 'DOUYIN_DL_FETCH_JSON',
    cacheKey: 'douyin-dlRemoteContent_v1',
    ratingKey: 'douyin-dlStoreRating_v1',
    footer: {
      showNotice: false,
      showHelpLinks: false,
      showSettings: true,
      email: 'hangdudu0@agent.qq.com',
      feedbackMode: 'copy',
      showDonate: true
    },
    onFillSettings: fillSettingsSheet,
    onFillDonate: fillDonateSheet,
    onFeedback: copyFeedbackEmail,
    defaults: {
      notice: {
        enabled: false,
        title: '公告',
        pinned: ['支持保存当前已能正常观看的单个视频，以及合集列表。不支持会员、付费或受 DRM 保护的内容。'],
        recent: [
          '1.0.1：合集可切换「列表下载」。先打开页面右侧「合集」，再点「刷新列表」，勾选后依次保存 MP4。',
          '1.0.1：下载可暂停、继续或取消；右下角悬浮按钮可拖动。',
          '1.0.0：支持识别当前视频、选择清晰度、保存 MP4 和封面。'
        ],
        knownIssues: [
          '用户主页、直播和图文笔记暂不支持。',
          '页面结构变化或视频权限限制时，可能暂时无法识别；请刷新页面后重试。'
        ],
        roadmap: {
          feedback: ['遇到问题或有改进建议，欢迎反馈视频链接、操作步骤和报错信息。'],
          upcoming: ['用户页批量下载。'],
          planned: []
        }
      },
      coop: {
        enabled: true,
        title: '开发合作',
        body: '接浏览器插件定制开发。\n\n有合作意向请联系 QQ：748604487\n邮箱：hangdudu0@agent.qq.com\n请备注「插件开发」，并简单说明需求。'
      },
      rating: { enabled: false, url: '', edge: '', chrome: '', firefox: '', minSuccess: 3 }
    },
    messages: {
      openPanel: 'DOUYIN_DL_OPEN_PANEL',
      openSheet: 'DOUYIN_DL_OPEN_SHEET'
    }
  });
  settingsReady = loadUserSettings();
  settingsReady.catch(() => {});

  const ui = document.createElement('div');
  ui.className = 'dy-dl';
  ui.innerHTML = `
    <div class="dy-dl-mode-tabs hidden" role="tablist" aria-label="下载模式" data-i18n-aria-label="downloadMode">
      <button type="button" data-mode="video" class="active" role="tab" aria-selected="true">单视频</button>
      <button type="button" data-mode="list" role="tab" aria-selected="false">列表下载</button>
    </div>
    <div class="dy-dl-video-body">
      <div class="dy-dl-video-card is-loading">
        <div class="dy-dl-cover-column">
          <div class="dy-dl-cover-wrap">
            <div class="dy-dl-sk-cover"></div>
            <img class="dy-dl-cover hidden" alt="">
            <div class="dy-dl-cover-ph hidden">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
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
        <div class="dy-dl-section-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          清晰度
        </div>
        <div class="dy-dl-quality-pills">
          <span class="dy-dl-pill loading">加载中</span>
        </div>
      </div>
      <div class="dy-dl-format-row dy-dl-section">
        <div class="dy-dl-section-head dy-dl-format-label">格式</div>
        <div class="dy-dl-format-pills">
          <button type="button" class="dy-dl-pill active" data-format="mp4" aria-pressed="true" disabled>MP4 视频</button>
        </div>
      </div>
      <p class="dy-dl-filename-preview" aria-live="polite">文件名预览会在识别视频后显示</p>
      <div class="dy-dl-estimate hidden">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
        <span class="dy-dl-estimate-text">预计大小 —</span>
      </div>
      <button type="button" class="dy-dl-btn dy-dl-start" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
        <span class="dy-dl-start-label">开始下载</span>
      </button>
      <div class="dy-dl-job-list hidden"></div>
      <div class="dy-dl-status hidden" role="status" aria-live="polite"></div>
      <div class="dy-dl-tools">
        <button type="button" class="dy-dl-history-btn dy-dl-retry-info hidden" data-action="retry-info">重新识别</button>
        <button type="button" class="dy-dl-history-btn" data-action="downloads">浏览器下载记录</button>
      </div>
    </div>
    <div class="dy-dl-list-body hidden">
      <p class="dy-dl-list-tip">要看全部分集：先打开页面右侧「合集」，再点「刷新列表」。</p>
      <div class="dy-dl-section">
        <div class="dy-dl-section-head">清晰度</div>
        <div class="dy-dl-list-quality-pills">
          <span class="dy-dl-pill loading">加载中</span>
        </div>
      </div>
      <div class="dy-dl-list-head">
        <div class="dy-dl-list-heading">
          <strong class="dy-dl-list-title">合集列表</strong>
          <span class="dy-dl-list-count"></span>
        </div>
        <div class="dy-dl-list-head-actions">
          <button type="button" class="dy-dl-list-tool dy-dl-list-refresh">刷新列表</button>
          <button type="button" class="dy-dl-list-tool dy-dl-list-select-all" title="选择当前已加载的所有视频" data-i18n-title="selectLoaded">全选</button>
        </div>
      </div>
      <div class="dy-dl-list-items"></div>
      <div class="dy-dl-list-actions">
        <button type="button" class="dy-dl-btn dy-dl-btn-secondary dy-dl-list-load-more hidden">继续加载</button>
        <button type="button" class="dy-dl-btn dy-dl-btn-secondary dy-dl-list-retry hidden">重试未完成</button>
        <button type="button" class="dy-dl-btn dy-dl-list-start" disabled>下载已选视频</button>
      </div>
      <div class="dy-dl-job-panel dy-dl-list-job-panel hidden">
        <div class="dy-dl-list-job-list"></div>
        <div class="dy-dl-job-panel-queue">
          <button type="button" class="dy-dl-action-btn dy-dl-list-pause">暂停</button>
          <button type="button" class="dy-dl-action-btn danger dy-dl-list-cancel hidden">取消整队</button>
        </div>
      </div>
      <p class="dy-dl-list-status hidden" aria-live="polite"></p>
    </div>
  `;
  markStaticUi(ui);
  shell.home.appendChild(ui);

  const modeTabsEl = ui.querySelector('.dy-dl-mode-tabs');
  const videoBodyEl = ui.querySelector('.dy-dl-video-body');
  const listBodyEl = ui.querySelector('.dy-dl-list-body');
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
  const filenamePreviewEl = ui.querySelector('.dy-dl-filename-preview');
  const estimateEl = ui.querySelector('.dy-dl-estimate');
  const estimateTextEl = ui.querySelector('.dy-dl-estimate-text');
  const startBtn = ui.querySelector('.dy-dl-start');
  const startLabelEl = ui.querySelector('.dy-dl-start-label');
  const PARALLEL_MAX = 3;
  const coverBtn = ui.querySelector('.dy-dl-cover-download');
  const jobListEl = ui.querySelector('.dy-dl-video-body .dy-dl-job-list');
  const statusEl = ui.querySelector('.dy-dl-video-body .dy-dl-status');
  const listPillsEl = ui.querySelector('.dy-dl-list-quality-pills');
  const listTitleEl = ui.querySelector('.dy-dl-list-title');
  const listCountEl = ui.querySelector('.dy-dl-list-count');
  const listSelectAllBtn = ui.querySelector('.dy-dl-list-select-all');
  const listItemsEl = ui.querySelector('.dy-dl-list-items');
  const listRefreshBtn = ui.querySelector('.dy-dl-list-refresh');
  const listLoadMoreBtn = ui.querySelector('.dy-dl-list-load-more');
  const listRetryBtn = ui.querySelector('.dy-dl-list-retry');
  const listStartBtn = ui.querySelector('.dy-dl-list-start');
  const listCancelBtn = ui.querySelector('.dy-dl-list-cancel');
  const listPauseBtn = ui.querySelector('.dy-dl-list-pause');
  const listJobPanel = ui.querySelector('.dy-dl-list-job-panel');
  const listJobListEl = ui.querySelector('.dy-dl-list-job-list');
  const listStatusEl = ui.querySelector('.dy-dl-list-status');

  let videoInfo = null;
  let videoLoadPending = false;
  let recoveryAttempts = 0;
  let recoveryTimer = 0;
  let pageAwemeIdHint = '';
  let selectedQn = 0;
  let listSelectedQn = 0;
  let activeMode = 'video';
  let currentMixId = '';
  let listItems = [];
  let selectedListIds = new Set();
  let listLoaded = false;
  let listLoading = false;
  let listLoadGeneration = 0;
  let listCursor = 0;
  let listHasMore = false;
  let listMeta = null;
  let listSidebarOpen = false;
  let queueRunning = false;
  let queueCancelled = false;
  let lastListFailures = [];
  let reqId = 0;
  const pending = new Map();
  const activeJobs = new Map();

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      try {
        EXT.storage.local.get(keys, (result) => {
          const error = EXT.runtime.lastError;
          if (error) reject(new Error(error.message || '读取设置失败'));
          else resolve(result || {});
        });
      } catch (error) { reject(error); }
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      try {
        EXT.storage.local.set(value, () => {
          const error = EXT.runtime.lastError;
          if (error) reject(new Error(error.message || '保存设置失败'));
          else resolve();
        });
      } catch (error) { reject(error); }
    });
  }

  function injectPageAgentScripts() {
    return new Promise((resolve, reject) => {
      if (window.__DOUYIN_DL_AGENT_READY__) {
        resolve();
        return;
      }
      const marker = 'script[data-dy-dl-agent-inject]';
      if (document.querySelector(marker)) {
        resolve();
        return;
      }
      const root = document.head || document.documentElement;
      const loadScript = (src, mark) => new Promise((res, rej) => {
        const el = document.createElement('script');
        el.src = src;
        if (mark) el.dataset.dyDlAgentInject = '1';
        el.onload = () => res();
        el.onerror = () => rej(new Error('脚本加载失败'));
        root.appendChild(el);
      });
      loadScript(EXT.runtime.getURL('lib/aweme-parse.js'))
        .then(() => loadScript(EXT.runtime.getURL('content/page-agent.js'), true))
        .then(resolve)
        .catch(reject);
    });
  }

  async function ensureAgentReady() {
    try {
      await agentCall('PING', {}, 3000);
      return true;
    } catch (_) { /* retry below */ }
    try {
      shell.debug.log('代理', '尝试注入页面脚本');
      await injectPageAgentScripts();
      await new Promise((resolve) => setTimeout(resolve, 120));
      await agentCall('PING', {}, 5000);
      shell.debug.log('代理', '注入后已就绪');
      return true;
    } catch (error) {
      shell.debug.log('代理', '未响应，请刷新页面');
      setStatus('页面代理未就绪，请刷新页面后重试', 'error');
      return false;
    }
  }

  function agentCall(type, payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = 'req-' + (++reqId) + '-' + crypto.randomUUID();
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
    // 成功/过程提示不占主界面；仅错误时显示状态条。
    if (!text || kind !== 'error') {
      statusEl.classList.add('hidden');
      setUiText(statusEl, '');
      statusEl.dataset.kind = '';
      if (text) shell.debug.log('状态', text);
      return;
    }
    statusEl.dataset.kind = 'error';
    setUiText(statusEl, text);
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

  function videoJobCount() {
    return [...activeJobs.values()].filter((job) => job.scope !== 'list').length;
  }

  function refreshVideoStartBtn() {
    const count = videoJobCount();
    const blocked = !videoInfo?.qualities?.length || queueRunning || count >= PARALLEL_MAX;
    startBtn.disabled = blocked;
    if (startLabelEl) {
      if (!count) setUiText(startLabelEl, '开始下载');
      else if (count >= PARALLEL_MAX) setUiText(startLabelEl, '并行已满 (' + count + ')');
      else setUiText(startLabelEl, '再下一个 (' + count + ')');
    }
  }

  function currentQuality() {
    return videoInfo?.qualities?.find((item) => item.qn === selectedQn) || videoInfo?.qualities?.[0] || null;
  }

  function displayQualities(list) {
    const items = (Array.isArray(list) ? list : []).slice().sort((a, b) => Number(b.qn) - Number(a.qn));
    const standard = items.filter((item) => Number(item.qn) > 360);
    return standard.length ? standard : items;
  }

  function pickDefaultQn(list) {
    const visible = displayQualities(list);
    const h264 = [...visible].filter((item) => !item.h265).sort((a, b) => b.qn - a.qn)[0];
    if (h264) return h264.qn;
    return visible[0]?.qn || 0;
  }

  function qualityLabel(item) {
    if (!item) return '';
    return tr(item.label);
  }

  function refreshFilenamePreview() {
    if (!filenamePreviewEl) return;
    if (!videoInfo) {
      setUiText(filenamePreviewEl, '文件名预览会在识别视频后显示');
      return;
    }
    const quality = currentQuality();
    const name = FILENAME.withExtension(FILENAME.renderTemplate(filenameSettings.filenameTemplate, videoInfo, {
      episode: videoInfo.episode,
      qualityLabel: qualityLabel(quality)
    }), 'mp4');
    filenamePreviewEl.replaceChildren();
    const label = document.createElement('span');
    label.className = 'dy-dl-filename-preview-label';
    setUiText(label, '保存为：');
    const filename = document.createElement('span');
    filename.className = 'dy-dl-filename-preview-name';
    filename.textContent = name;
    filename.title = name;
    filenamePreviewEl.append(label, filename);
  }

  function refreshEstimate() {
    const quality = currentQuality();
    const bytes = parse.estimateQualityBytes(quality, videoInfo?.duration);
    if (!bytes) {
      estimateEl.classList.add('hidden');
      return;
    }
    let text = '预计大小：约 ' + parse.formatBytes(bytes) + '（约数，仅供参考）';
    if (quality?.h265) text += ' · 部分播放器可能只有声音';
    setUiText(estimateTextEl, text);
    estimateEl.classList.remove('hidden');
  }

  function renderQualityPills(list) {
    pillsEl.replaceChildren();
    if (!list?.length) {
      const empty = document.createElement('span');
      empty.className = 'dy-dl-pill disabled';
      setUiText(empty, '无可用清晰度');
      pillsEl.appendChild(empty);
      selectedQn = 0;
      return;
    }
    const visible = displayQualities(list);
    if (!visible.some((item) => item.qn === selectedQn)) selectedQn = pickDefaultQn(visible);
    visible.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dy-dl-pill' + (item.qn === selectedQn ? ' active' : '');
      setUiText(btn, qualityLabel(item));
      btn.setAttribute('aria-pressed', String(item.qn === selectedQn));
      btn.onclick = () => {
        selectedQn = item.qn;
        listSelectedQn = item.qn;
        renderQualityPills(visible);
        if (listItems.length) renderListQualityPills(collectListQualities(listItems));
        refreshEstimate();
        refreshFilenamePreview();
      };
      pillsEl.appendChild(btn);
    });
  }

  function normalizeCoverUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.startsWith('//')) return 'https:' + text;
    return text.replace(/^http:\/\//i, 'https://');
  }

  function showCover(url) {
    const normalized = normalizeCoverUrl(url);
    if (!normalized || !/^https:\/\//i.test(normalized)) {
      coverImg.classList.add('hidden');
      coverImg.removeAttribute('src');
      coverImg.onload = null;
      coverImg.onerror = null;
      coverPh.classList.remove('hidden');
      coverSk.classList.add('hidden');
      coverBtn.disabled = true;
      return;
    }
    coverImg.referrerPolicy = 'no-referrer';
    coverImg.decoding = 'async';
    coverImg.src = normalized;
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
    coverBtn.disabled = coverBusy;
  }

  let shownCoverId = '';
  let shownCoverUrl = '';

  function playerCoverFromDom() {
    const root = document.getElementById('douyin-dl-root');
    const videos = [...document.querySelectorAll('video')].filter((video) => {
      if (root?.contains(video)) return false;
      const rect = video.getBoundingClientRect();
      return rect.width > 40 && rect.height > 40;
    });
    const active = videos.find((video) => !video.paused && video.readyState > 0) || videos[0];
    if (!active) return '';
    const poster = normalizeCoverUrl(active.poster);
    if (/^https:\/\//i.test(poster)) return poster;
    const box = active.closest('.xgplayer') || active.parentElement;
    if (!box || root?.contains(box)) return '';
    const styled = box.querySelector('.xgplayer-poster, [class*="poster"]');
    const bg = String(styled?.style?.backgroundImage || '');
    const fromBg = bg.match(/url\(["']?(https:[^"')]+)/i);
    return normalizeCoverUrl(fromBg?.[1] || '');
  }

  function showVideoCover(info) {
    const previousId = shownCoverId;
    const previousUrl = shownCoverUrl;
    const api = normalizeCoverUrl(info?.cover);
    const live = playerCoverFromDom();
    const stuck = Boolean(previousId && info?.id && info.id !== previousId && api && api === previousUrl && live && live !== api);
    const next = stuck ? live : (api || live || '');
    if (info) info.cover = next;
    shownCoverId = info?.id || '';
    shownCoverUrl = next;
    showCover(next);
    if (!info?.id || !previousUrl) return;
    const id = info.id;
    [500, 1400].forEach((delay) => {
      setTimeout(() => {
        try {
          if (!coverImg.isConnected || videoInfo?.id !== id) return;
          const again = playerCoverFromDom();
          const current = normalizeCoverUrl(coverImg.getAttribute('src'));
          if (!again || again === current || current !== previousUrl) return;
          videoInfo.cover = again;
          shownCoverUrl = again;
          showCover(again);
        } catch (_) { /* 页面已关闭 */ }
      }, delay);
    });
  }

  function shortListLabel(item) {
    if (item?.episode) return `第${item.episode}集`;
    const title = String(item?.title || '').replace(/\s+/g, ' ').trim();
    return title.length > 20 ? title.slice(0, 20) + '…' : (title || '视频');
  }

  function setListStatus(text, kind) {
    if (!text) {
      listStatusEl.classList.add('hidden');
      setUiText(listStatusEl, '');
      listStatusEl.removeAttribute('data-type');
      return;
    }
    listStatusEl.dataset.type = kind || '';
    setUiText(listStatusEl, text);
    listStatusEl.classList.remove('hidden');
  }

  function syncModeTabs() {
    const hasMix = Boolean(currentMixId);
    modeTabsEl.classList.toggle('hidden', !hasMix);
    if (!hasMix && activeMode === 'list') {
      activeMode = 'video';
    }
    modeTabsEl.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === activeMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    videoBodyEl.classList.toggle('hidden', activeMode === 'list');
    listBodyEl.classList.toggle('hidden', activeMode !== 'list');
    syncCollectionGuide();
  }

  function collectionComplete() {
    if (listHasMore || listItems.length <= 1) return false;
    const updatedTo = Number(listMeta?.updatedTo) || 0;
    if (updatedTo > 0) return listItems.length >= updatedTo;
    // 页面没有「更新至」时，右侧合集节点经常扫不到。没有下一页且已经不是开头几集，就视为拿全。
    return listSidebarOpen || listItems.length >= 8;
  }

  function syncCollectionGuide() {
    const show = Boolean(currentMixId) && !collectionComplete();
    ui.querySelector('.dy-dl-list-body > .dy-dl-list-tip')?.classList.toggle('hidden', !show);
  }

  function updateMixAvailability(info) {
    const nextMixId = info?.mix?.id || parse.parseMixId(location.href) || '';
    if (nextMixId !== currentMixId) {
      listLoadGeneration += 1;
      listLoaded = false;
      listItems = [];
      selectedListIds = new Set();
      listSidebarOpen = false;
      listMeta = null;
    }
    currentMixId = nextMixId;
    if (!currentMixId) {
      listLoaded = false;
      listItems = [];
      selectedListIds = new Set();
    } else if (info?.mix?.name) {
      listTitleEl.textContent = info.mix.name;
    }
    syncModeTabs();
  }

  function pickQnForInfo(info, preferredQn) {
    const list = Array.isArray(info?.qualities) ? info.qualities : [];
    if (!list.length) return 0;
    if (list.some((item) => item.qn === preferredQn)) return preferredQn;
    const lower = [...list].filter((item) => item.qn <= preferredQn).sort((a, b) => b.qn - a.qn)[0];
    if (lower) return lower.qn;
    return [...list].sort((a, b) => b.qn - a.qn)[0].qn;
  }

  function collectListQualities(items) {
    const map = new Map();
    (items || []).forEach((item) => {
      (item.qualities || []).forEach((quality) => {
        if (!map.has(quality.qn) || (quality.size || 0) > (map.get(quality.qn).size || 0)) {
          map.set(quality.qn, { qn: quality.qn, label: quality.label, size: quality.size || 0 });
        }
      });
    });
    return [...map.values()].sort((a, b) => b.qn - a.qn);
  }

  function renderListQualityPills(list) {
    listPillsEl.replaceChildren();
    if (!list?.length) {
      const empty = document.createElement('span');
      empty.className = 'dy-dl-pill disabled';
      setUiText(empty, '无可用清晰度');
      listPillsEl.appendChild(empty);
      listSelectedQn = 0;
      return;
    }
    const visible = displayQualities(list);
    if (!visible.some((item) => item.qn === listSelectedQn)) listSelectedQn = pickDefaultQn(visible);
    visible.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dy-dl-pill' + (item.qn === listSelectedQn ? ' active' : '');
      setUiText(btn, qualityLabel(item));
      btn.setAttribute('aria-pressed', String(item.qn === listSelectedQn));
      btn.onclick = () => {
        listSelectedQn = item.qn;
        selectedQn = item.qn;
        renderListQualityPills(visible);
        if (videoInfo?.qualities?.length) renderQualityPills(videoInfo.qualities);
      };
      listPillsEl.appendChild(btn);
    });
  }

  function listTotalHint() {
    const updatedTo = Number(listMeta?.updatedTo) || 0;
    return updatedTo > 0 ? ` / 共 ${updatedTo} 集` : '';
  }

  function updateListLoadMore() {
    if (listRefreshBtn) {
      listRefreshBtn.disabled = listLoading || queueRunning;
      setUiText(listRefreshBtn, listLoading ? '正在加载…' : '刷新列表');
    }
    if (!listLoadMoreBtn) return;
    const show = listHasMore && !listLoading && listItems.length > 0;
    listLoadMoreBtn.classList.toggle('hidden', !show);
    listLoadMoreBtn.disabled = listLoading || queueRunning;
    setUiText(listLoadMoreBtn, listLoading ? '正在加载…' : '继续加载');
  }

  function updateListSelection() {
    const total = listItems.length;
    const selected = selectedListIds.size;
    setUiText(listCountEl, total
      ? `已加载 ${total}${listTotalHint()} · 已选 ${selected} 个`
      : '尚未加载到合集视频');
    const allSelected = total > 0 && selected === total;
    setUiText(listSelectAllBtn, allSelected ? '取消全选' : '全选');
    listSelectAllBtn.setAttribute('aria-pressed', String(allSelected));
    listSelectAllBtn.disabled = !total || queueRunning;
    listStartBtn.disabled = !selected || queueRunning || activeJobs.size > 0;
    setUiText(listStartBtn, selected ? `下载已选 ${selected} 个` : '下载已选视频');
    if (listRetryBtn) {
      listRetryBtn.classList.toggle('hidden', !lastListFailures.length || queueRunning);
      listRetryBtn.disabled = queueRunning;
      setUiText(listRetryBtn, lastListFailures.length ? `重试未完成（${lastListFailures.length}）` : '重试未完成');
    }
    listCancelBtn.classList.toggle('hidden', !queueRunning);
    syncCollectionGuide();
    syncListJobPanel();
    updateListLoadMore();
  }

  function syncListJobPanel() {
    const job = [...activeJobs.values()].find((item) => item.scope === 'list');
    listJobPanel.classList.toggle('hidden', !queueRunning && !job);
    listPauseBtn.disabled = !job;
    setUiText(listPauseBtn, job?.paused ? '继续' : '暂停');
  }

  function mergeListItems(items) {
    const existing = new Set(listItems.map((item) => item.id));
    const fresh = (Array.isArray(items) ? items : []).filter((item) => item?.id && !existing.has(item.id));
    listItems.push(...fresh);
    listItems.sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0) || String(a.id).localeCompare(String(b.id)));
    return fresh.length;
  }

  function renderListItems() {
    listItemsEl.replaceChildren();
    if (!listItems.length) {
      const empty = document.createElement('p');
      empty.className = 'dy-dl-list-empty';
      setUiText(empty, '没有可下载的合集视频。');
      listItemsEl.appendChild(empty);
      updateListSelection();
      return;
    }
    const fragment = document.createDocumentFragment();
    listItems.forEach((item, index) => {
      const label = document.createElement('label');
      label.className = 'dy-dl-list-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.id = item.id;
      checkbox.checked = selectedListIds.has(item.id);
      checkbox.disabled = queueRunning;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedListIds.add(item.id);
        else selectedListIds.delete(item.id);
        updateListSelection();
      });
      const thumbWrap = document.createElement('span');
      thumbWrap.className = 'dy-dl-list-item-thumb-wrap';
      const coverUrl = normalizeCoverUrl(item.cover);
      if (coverUrl && /^https:\/\//i.test(coverUrl)) {
        const thumb = document.createElement('img');
        thumb.className = 'dy-dl-list-item-thumb';
        thumb.alt = '';
        thumb.referrerPolicy = 'no-referrer';
        thumb.decoding = 'async';
        thumb.loading = 'lazy';
        thumb.src = coverUrl;
        thumb.onerror = () => {
          thumb.remove();
          thumbWrap.classList.add('is-empty');
        };
        thumbWrap.appendChild(thumb);
      } else {
        thumbWrap.classList.add('is-empty');
      }
      const ordinal = document.createElement('span');
      ordinal.className = 'dy-dl-list-item-index';
      setUiText(ordinal, String(item.episode || index + 1));
      const meta = document.createElement('span');
      meta.className = 'dy-dl-list-item-meta';
      const title = document.createElement('strong');
      title.className = 'dy-dl-list-item-title';
      const titleText = item.episode ? tr(`第${item.episode}集`) + ' · ' + item.title : item.title;
      title.textContent = titleText;
      title.title = titleText;
      const detail = document.createElement('small');
      setUiText(detail, [
        item.playCount ? parse.formatCount(item.playCount) + tr('播放') : '',
        item.duration ? parse.formatDuration(item.duration) : ''
      ].filter(Boolean).join(' · '));
      meta.append(title, detail);
      label.append(checkbox, thumbWrap, ordinal, meta);
      fragment.appendChild(label);
    });
    listItemsEl.appendChild(fragment);
    updateListSelection();
  }

  async function loadListItems(force) {
    if (!currentMixId) {
      setListStatus('当前作品不属于合集。', 'error');
      return;
    }
    if (listLoading) return;
    if (listLoaded && !force) return;
    const requestId = ++listLoadGeneration;
    const mixId = currentMixId;
    const awemeId = parse.parseAwemeId(location.href);
    listLoading = true;
    updateListLoadMore();
    setListStatus(force ? '正在刷新合集列表…' : '正在读取已缓存的合集…');
    listStartBtn.disabled = true;
    try {
      const data = await agentCall('RESOLVE_MIX', {
        href: location.href,
        mixId,
        awemeId: currentAwemeId(),
        force: Boolean(force),
        fetchAll: Boolean(force),
        maxPages: force ? 8 : 0
      }, force ? 60000 : 15000);
      if (requestId !== listLoadGeneration || mixId !== currentMixId
        || awemeId !== parse.parseAwemeId(location.href)) {
        return;
      }
      listItems = Array.isArray(data.items) ? [...data.items] : [];
      listItems.sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0) || String(a.id).localeCompare(String(b.id)));
      selectedListIds = new Set(listItems.filter((item) => selectedListIds.has(item.id)).map((item) => item.id));
      listCursor = data.cursor || 0;
      listHasMore = Boolean(data.hasMore)
        || (Number(data.meta?.updatedTo) > 0 && listItems.length < Number(data.meta.updatedTo));
      listMeta = data.meta || null;
      listSidebarOpen = Boolean(data.sidebarOpen);
      listTitleEl.textContent = data.title || data.meta?.name || '合集列表';
      listLoaded = true;
      renderListQualityPills(collectListQualities(listItems));
      renderListItems();
      if (!listItems.length) setListStatus('未读到合集。打开右侧「合集」后再点「刷新列表」。');
      else if (listHasMore) setListStatus('列表尚未完整，可点「继续加载」。');
      else if (collectionComplete()) setListStatus('勾选合集视频后将依次下载；下载期间请保持页面打开。');
      else setListStatus('');
    } catch (error) {
      if (requestId !== listLoadGeneration || mixId !== currentMixId
        || awemeId !== parse.parseAwemeId(location.href)) {
        return;
      }
      setListStatus(error.message || '读取合集失败', 'error');
      shell.debug.log('合集', error.message || error);
    } finally {
      if (requestId === listLoadGeneration) {
        listLoading = false;
        updateListSelection();
      }
    }
  }

  async function loadMoreListItems() {
    if (!currentMixId || listLoading || !listHasMore) return;
    listLoading = true;
    updateListLoadMore();
    setListStatus(`正在加载更多（当前 ${listItems.length} 集）…`);
    try {
      const data = await agentCall('LOAD_MIX_MORE', {
        mixId: currentMixId,
        cursor: listCursor
      }, 30000);
      const added = mergeListItems(data.items);
      listCursor = data.cursor || listCursor;
      listHasMore = Boolean(data.hasMore)
        || (Number(data.meta?.updatedTo || listMeta?.updatedTo) > 0
          && listItems.length < Number(data.meta?.updatedTo || listMeta?.updatedTo));
      if (data.meta) listMeta = { ...listMeta, ...data.meta };
      renderListQualityPills(collectListQualities(listItems));
      renderListItems();
      setListStatus(added ? `已加载 ${added} 集，当前共 ${listItems.length} 集。` : '没有更多可加载的视频。');
      shell.debug.log('合集', '分页 +' + added + ' · 累计 ' + listItems.length);
    } catch (error) {
      setListStatus(error.message || '继续加载失败', 'error');
      shell.debug.log('合集', error.message || error);
    } finally {
      listLoading = false;
      updateListSelection();
    }
  }

  async function setDownloadMode(mode) {
    activeMode = mode === 'list' ? 'list' : 'video';
    syncModeTabs();
    if (activeMode === 'list' && !listLoaded && !listLoading) await loadListItems(true);
  }

  function formatPopupSub(info) {
    if (!info) return '';
    const parts = [];
    const qLabel = currentQuality()?.label;
    if (qLabel) parts.push(qLabel);
    if (info.playCount) parts.push(parse.formatCount(info.playCount) + tr('播放'));
    if (info.duration) parts.push(parse.formatDuration(info.duration));
    return parts.length ? parts.join(' · ') : 'MP4 视频';
  }

  function currentAwemeId() {
    return parse.parseAwemeId(location.href) || pageAwemeIdHint || videoInfo?.id || '';
  }

  function applyTheme(theme) {
    const value = THEMES.some((item) => item.id === theme) ? theme : 'douyin';
    selectedTheme = value;
    if (shell?.panel?.root) shell.panel.root.dataset.theme = value;
  }

  async function loadUserSettings() {
    try {
      const [saved, themeData] = await Promise.all([
        settingsStore.loadSettings(),
        storageGet(THEME_KEY)
      ]);
      filenameSettings = saved;
      applyTheme(themeData[THEME_KEY]);
    } catch (_) {
      filenameSettings = SETTINGS.cloneDefaults();
      applyTheme('douyin');
    }
    return { filenameSettings, theme: selectedTheme };
  }

  async function saveTheme(theme) {
    const next = THEMES.some((item) => item.id === theme) ? theme : 'douyin';
    const previous = selectedTheme;
    applyTheme(next);
    try { await storageSet({ [THEME_KEY]: next }); }
    catch (error) {
      applyTheme(previous);
      throw error;
    }
    return next;
  }

  async function copyFeedbackEmail(email, button) {
    const label = button.querySelector('.dl-kit-feedback-label') || button;
    const original = label.textContent;
    let copied = false;
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch (_) { /* use the compatible document fallback */ }
    if (!copied) {
      const input = document.createElement('textarea');
      input.value = email;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      input.remove();
    }
    if (copied) {
      setUiText(label, '已复制');
      button.classList.add('is-copied');
      setTimeout(() => {
        if (!button.isConnected) return;
        setUiText(label, original);
        button.classList.remove('is-copied');
      }, 1600);
      return;
    }
    const link = document.createElement('a');
    link.href = 'mailto:' + email + '?subject=' + encodeURIComponent('抖音视频下载助手反馈');
    link.click();
  }

  function syncThemePicker(themeControl, theme) {
    if (!themeControl) return;
    const current = THEMES.find((item) => item.id === theme) || THEMES[0];
    const currentLabel = themeControl.querySelector('.dy-dl-settings-theme-current-label');
    const currentSwatch = themeControl.querySelector('.dy-dl-settings-theme-current-swatch');
    if (currentLabel) setUiText(currentLabel, themeName(current));
    if (currentSwatch) currentSwatch.dataset.theme = current.id;
    themeControl.querySelectorAll('[data-theme-option]').forEach((option) => {
      option.setAttribute('aria-selected', String(option.dataset.themeOption === current.id));
    });
  }

  function fillDonateSheet(body) {
    body.replaceChildren();
    const donation = document.createElement('section');
    donation.className = 'dy-dl-donate';
    const intro = document.createElement('p');
    intro.className = 'dy-dl-donate-intro';
    setUiText(intro, '您的支持将用于持续维护适配、改进下载体验。赞赏完全自愿，下载功能始终免费。');
    const methods = document.createElement('div');
    methods.className = 'dy-dl-donate-methods';
    methods.setAttribute('aria-label', '选择赞赏方式');
    const code = document.createElement('div');
    code.className = 'dy-dl-donate-code';
    const image = document.createElement('img');
    image.alt = '';
    const buttons = [];
    const options = [
      { id: 'wechat', label: '微信赞赏', file: 'assets/donate-wechat.jpg' },
      { id: 'alipay', label: '支付宝', file: 'assets/donate-alipay.jpg' }
    ];
    const selectMethod = (option) => {
      code.dataset.method = option.id;
      image.src = EXT.runtime.getURL(option.file);
      image.alt = option.label + '二维码';
      buttons.forEach((button) => {
        const active = button.dataset.method === option.id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dy-dl-donate-method';
      button.dataset.method = option.id;
      button.setAttribute('aria-pressed', 'false');
      setUiText(button, option.label);
      button.addEventListener('click', () => selectMethod(option));
      buttons.push(button);
      methods.appendChild(button);
    });
    code.appendChild(image);
    donation.append(intro, methods, code);
    body.appendChild(donation);
    selectMethod(options[0]);
  }

  function markStaticUi(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (/[\u3400-\u9fff]/.test(walker.currentNode.textContent)) nodes.push(walker.currentNode);
    }
    nodes.forEach((node) => {
      const span = document.createElement('span');
      setUiText(span, node.textContent.trim());
      node.replaceWith(span);
    });
  }

  function tr(text) {
    return DownloaderKit.i18n?.translateText?.(String(text ?? '')) ?? String(text ?? '');
  }

  function setUiText(node, text) {
    if (DownloaderKit.i18n?.setText) DownloaderKit.i18n.setText(node, text);
    else node.textContent = tr(text);
  }

  function t(key) {
    return globalThis.DownloaderKit?.i18n?.t?.(key) || key;
  }

  function templateError(error) {
    const text = String(error || '');
    if (text === '文件名模板不能为空') return t('templateEmpty');
    if (text === '模板不能包含路径分隔符') return t('templatePath');
    if (text.startsWith('未知变量：')) return t('unknownField') + text.slice('未知变量：'.length);
    return text;
  }

  function themeName(theme) {
    const translated = t('theme-' + theme.id);
    return translated === 'theme-' + theme.id ? theme.name : translated;
  }

  function fillSettingsSheet(body) {
    body.replaceChildren();
    const root = document.createElement('div');
    root.className = 'dy-dl-settings';

    const themeRow = document.createElement('div');
    themeRow.className = 'dy-dl-settings-row';
    const themeRowLabel = document.createElement('span');
    setUiText(themeRowLabel, t('theme'));
    const themeControl = document.createElement('div');
    themeControl.className = 'dy-dl-settings-theme-control';
    const themeTrigger = document.createElement('button');
    themeTrigger.type = 'button';
    themeTrigger.className = 'dy-dl-settings-theme-trigger';
    themeTrigger.setAttribute('aria-label', t('theme'));
    themeTrigger.setAttribute('aria-haspopup', 'listbox');
    themeTrigger.setAttribute('aria-expanded', 'false');
    const currentSwatch = document.createElement('span');
    currentSwatch.className = 'dy-dl-settings-theme-swatch dy-dl-settings-theme-current-swatch';
    currentSwatch.setAttribute('aria-hidden', 'true');
    const currentLabel = document.createElement('span');
    currentLabel.className = 'dy-dl-settings-theme-current-label';
    const chevron = document.createElement('span');
    chevron.className = 'dy-dl-settings-theme-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    themeTrigger.append(currentSwatch, currentLabel, chevron);
    const themeOptions = document.createElement('div');
    themeOptions.className = 'dy-dl-settings-theme-options hidden';
    themeOptions.id = 'dy-dl-settings-theme-options';
    themeOptions.setAttribute('role', 'listbox');
    themeTrigger.setAttribute('aria-controls', themeOptions.id);
    THEMES.forEach((theme) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'dy-dl-settings-theme-option';
      option.dataset.themeOption = theme.id;
      option.dataset.label = themeName(theme);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(selectedTheme === theme.id));
      const swatch = document.createElement('span');
      swatch.className = 'dy-dl-settings-theme-swatch';
      swatch.dataset.theme = theme.id;
      swatch.setAttribute('aria-hidden', 'true');
      const optionLabel = document.createElement('span');
      setUiText(optionLabel, themeName(theme));
      option.append(swatch, optionLabel);
      option.addEventListener('click', async (event) => {
        if (!event.isTrusted) return;
        const previous = selectedTheme;
        themeOptions.classList.add('hidden');
        themeTrigger.setAttribute('aria-expanded', 'false');
        try {
          await saveTheme(theme.id);
          syncThemePicker(themeControl, selectedTheme);
          setUiText(status, t('themeSaved'));
        } catch (error) {
          applyTheme(previous);
          syncThemePicker(themeControl, previous);
          setUiText(status, error?.message || t('themeSaveFailed'));
        }
      });
      themeOptions.appendChild(option);
    });
    themeTrigger.addEventListener('click', () => {
      const isOpen = !themeOptions.classList.contains('hidden');
      themeOptions.classList.toggle('hidden', isOpen);
      themeTrigger.setAttribute('aria-expanded', String(!isOpen));
    });
    themeControl.append(themeTrigger, themeOptions);
    themeRow.append(themeRowLabel, themeControl);
    root.appendChild(themeRow);
    syncThemePicker(themeControl, selectedTheme);

    const languageRow = document.createElement('label');
    languageRow.className = 'dy-dl-settings-row';
    const languageLabel = document.createElement('span');
    setUiText(languageLabel, t('language'));
    const languageControl = document.createElement('div');
    languageControl.className = 'dy-dl-settings-control';
    const languageWrap = document.createElement('div');
    languageWrap.className = 'dy-dl-settings-select-wrap';
    const languageSelect = document.createElement('select');
    languageSelect.className = 'dy-dl-settings-select';
    languageSelect.setAttribute('aria-label', t('language'));
    [
      ['zh-CN', t('chinese')],
      ['en', t('english')]
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      setUiText(option, label);
      languageSelect.appendChild(option);
    });
    languageSelect.value = globalThis.DownloaderKit?.i18n?.language?.() || 'zh-CN';
    languageSelect.addEventListener('mousedown', () => {
      themeOptions.classList.add('hidden');
      themeTrigger.setAttribute('aria-expanded', 'false');
    });
    languageSelect.addEventListener('change', (event) => {
      if (!event.isTrusted) return;
      const value = languageSelect.value === 'en' ? 'en' : 'zh-CN';
      const save = globalThis.DownloaderKit?.i18n?.save;
      if (!save) return;
      save(value).then(() => shell.openSheet('settings')).catch(() => {});
    });
    languageWrap.appendChild(languageSelect);
    languageControl.appendChild(languageWrap);
    languageRow.append(languageLabel, languageControl);
    root.appendChild(languageRow);

    const presetRow = document.createElement('label');
    presetRow.className = 'dy-dl-settings-row';
    const presetLabel = document.createElement('span');
    setUiText(presetLabel, t('filename'));
    const filenameControl = document.createElement('div');
    filenameControl.className = 'dy-dl-settings-control';
    const presetWrap = document.createElement('div');
    presetWrap.className = 'dy-dl-settings-select-wrap';
    const preset = document.createElement('select');
    preset.className = 'dy-dl-settings-select';
    preset.setAttribute('aria-label', t('filenameRule'));
    preset.addEventListener('mousedown', () => {
      themeOptions.classList.add('hidden');
      themeTrigger.setAttribute('aria-expanded', 'false');
    });
    [
      ['title', t('presetTitle')],
      ['title-id', t('presetTitleId')],
      ['title-id-quality', t('presetTitleIdQuality')],
      ['detailed', t('presetDetailed')],
      ['custom', t('presetCustom')]
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      setUiText(option, label);
      preset.appendChild(option);
    });
    presetWrap.appendChild(preset);
    filenameControl.appendChild(presetWrap);
    presetRow.append(presetLabel, filenameControl);
    root.appendChild(presetRow);

    const customBlock = document.createElement('div');
    customBlock.className = 'dy-dl-settings-custom';
    customBlock.hidden = true;
    const template = document.createElement('input');
    template.type = 'text';
    template.className = 'dy-dl-settings-input';
    template.maxLength = 240;
    template.spellcheck = false;
    template.autocomplete = 'off';
    template.placeholder = '{title} - {author}';
    template.setAttribute('aria-label', t('customTemplate'));
    customBlock.appendChild(template);
    const chips = document.createElement('div');
    chips.className = 'dy-dl-settings-chips';
    chips.setAttribute('aria-label', t('insertField'));
    const chipKeys = { title: 'chipTitle', author: 'chipAuthor', id: 'chipId', episode: 'chipEpisode', quality: 'chipQuality', date: 'chipDate' };
    FILENAME.VARIABLES.forEach((item) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'dy-dl-settings-chip';
      setUiText(chip, t(chipKeys[item.key] || item.label));
      chip.title = '{' + item.key + '}';
      chip.addEventListener('click', (event) => {
        if (!event.isTrusted) return;
        const start = template.selectionStart ?? template.value.length;
        const end = template.selectionEnd ?? start;
        const token = '{' + item.key + '}';
        template.value = template.value.slice(0, start) + token + template.value.slice(end);
        const pos = start + token.length;
        template.focus();
        template.setSelectionRange(pos, pos);
        syncPresetFromTemplate();
        refreshPreview();
        queueSave();
      });
      chips.appendChild(chip);
    });
    customBlock.appendChild(chips);
    root.appendChild(customBlock);

    const preview = document.createElement('p');
    preview.className = 'dy-dl-settings-preview';
    preview.setAttribute('aria-live', 'polite');
    const error = document.createElement('p');
    error.className = 'dy-dl-settings-error';
    error.hidden = true;
    root.append(preview, error);

    const foot = document.createElement('div');
    foot.className = 'dy-dl-settings-foot';
    const status = document.createElement('span');
    status.className = 'dy-dl-settings-status';
    status.setAttribute('role', 'status');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'dy-dl-settings-reset';
    setUiText(reset, t('resetFilename'));
    foot.append(status, reset);
    root.appendChild(foot);
    body.appendChild(root);

    let saveTimer = 0;
    const sampleMeta = {
      title: t('sampleTitle'),
      author: t('sampleAuthor'),
      id: '7653794808998426996',
      episode: 3
    };

    function matchPreset(value) {
      const text = String(value || '').trim();
      for (const [key, tpl] of Object.entries(FILENAME.PRESETS)) {
        if (tpl === text) return key;
      }
      return 'custom';
    }

    function syncCustomVisibility() {
      customBlock.hidden = preset.value !== 'custom';
    }

    function syncPresetFromTemplate() {
      preset.value = matchPreset(template.value.trim());
      syncCustomVisibility();
    }

    function currentTemplate() {
      if (preset.value !== 'custom' && FILENAME.PRESETS[preset.value]) {
        return FILENAME.PRESETS[preset.value];
      }
      return template.value.trim();
    }

    function refreshPreview() {
      const check = FILENAME.validateTemplate(currentTemplate());
      if (!check.ok) {
        error.hidden = false;
        setUiText(error, templateError(check.error));
        preview.textContent = '—';
        return false;
      }
      error.hidden = true;
      setUiText(error, '');
      preview.textContent = t('previewPrefix') + FILENAME.withExtension(FILENAME.renderTemplate(check.template, sampleMeta, {
        qualityLabel: '1080P',
        episode: 3,
        date: FILENAME.todayLocal()
      }), 'mp4');
      return check.template;
    }

    function applyForm(settings) {
      template.value = settings.filenameTemplate || SETTINGS.DEFAULTS.filenameTemplate;
      preset.value = matchPreset(template.value);
      syncCustomVisibility();
      refreshPreview();
    }

    async function persist(showOk) {
      const nextTemplate = refreshPreview();
      if (!nextTemplate) {
        setUiText(status, t('templateInvalid'));
        return;
      }
      try {
        filenameSettings = await settingsStore.saveSettings({ filenameTemplate: nextTemplate });
        refreshFilenamePreview();
        setUiText(status, showOk ? t('saved') : '');
      } catch (err) {
        setUiText(status, err?.message || t('saveFailed'));
      }
    }

    function queueSave() {
      setUiText(status, '');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { persist(true); }, 280);
    }

    preset.addEventListener('change', (event) => {
      if (!event.isTrusted) return;
      if (preset.value !== 'custom' && FILENAME.PRESETS[preset.value]) {
        template.value = FILENAME.PRESETS[preset.value];
      }
      syncCustomVisibility();
      refreshPreview();
      queueSave();
    });
    template.addEventListener('input', () => {
      syncPresetFromTemplate();
      refreshPreview();
      queueSave();
    });
    reset.addEventListener('click', async (event) => {
      if (!event.isTrusted) return;
      try {
        filenameSettings = await settingsStore.resetSettings();
        applyForm(filenameSettings);
        refreshFilenamePreview();
        setUiText(status, t('filenameReset'));
      } catch (err) {
        setUiText(status, err?.message || t('resetFailed'));
      }
    });

    applyForm(filenameSettings);
    settingsReady.then(() => {
      applyForm(filenameSettings);
      syncThemePicker(themeControl, selectedTheme);
    }).catch(() => {});
  }

  document.addEventListener('pointerdown', (event) => {
    const themeControl = document.querySelector('.dy-dl-settings-theme-control');
    if (!themeControl || themeControl.contains(event.target)) return;
    const themeOptions = themeControl.querySelector('.dy-dl-settings-theme-options');
    const themeTrigger = themeControl.querySelector('.dy-dl-settings-theme-trigger');
    themeOptions?.classList.add('hidden');
    themeTrigger?.setAttribute('aria-expanded', 'false');
  });

  EXT.storage.onChanged?.addListener?.((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[THEME_KEY]) applyTheme(changes[THEME_KEY].newValue);
    if (changes[SETTINGS.STORAGE_KEY]?.newValue) {
      filenameSettings = SETTINGS.normalizeSettings(changes[SETTINGS.STORAGE_KEY].newValue);
    }
  });

  function formatRelativeTime(timestamp) {
    const value = Number(timestamp) || 0;
    if (!value) return '';
    const diff = Math.max(0, Date.now() - value * 1000);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return tr('刚刚');
    if (minutes < 60) return tr(minutes + '分钟前');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return tr(hours + '小时前');
    const days = Math.floor(hours / 24);
    if (days < 30) return tr(days + '天前');
    const months = Math.floor(days / 30);
    if (months < 12) return tr(months + '个月前');
    return tr(Math.floor(months / 12) + '年前');
  }

  function applyVideoInfo(info) {
    const urlId = parse.parseAwemeId(location.href);
    const expectedId = urlId || pageAwemeIdHint || info?.id || '';
    if (!info || info.id !== expectedId || typeof info.title !== 'string'
      || !Array.isArray(info.qualities) || !info.qualities.length
      || !info.qualities.some((quality) => quality.urls?.length)
      || info.qualities.some((quality) => !Number.isFinite(quality.qn) || !Array.isArray(quality.urls))) {
      throw new Error('识别结果与当前作品不匹配，请刷新页面后重试');
    }
    if (!urlId && info.id) pageAwemeIdHint = info.id;
    videoInfo = info;
    ui.querySelector('.dy-dl-retry-info').classList.add('hidden');
    setVideoLoading(false);
    delete titleEl.dataset.i18nUiMessage;
    titleEl.textContent = info.title;
    if (info.author) {
      authorEl.textContent = info.author;
      authorEl.classList.remove('hidden');
    } else {
      authorEl.classList.add('hidden');
    }
    const details = [];
    if (info.playCount) details.push(parse.formatCount(info.playCount) + ' ' + t('play'));
    if (info.createTime) details.push(formatRelativeTime(info.createTime));
    setUiText(subEl, details.length ? details.join(' · ') : '抖音视频');
    showVideoCover(info);
    shell.debug.log('封面', info.cover || '空');
    selectedQn = pickDefaultQn(displayQualities(info.qualities));
    renderQualityPills(info.qualities);
    refreshEstimate();
    refreshFilenamePreview();
    refreshVideoStartBtn();
    setStatus('');
    updateMixAvailability(info);
    shell.debug.log('识别', info.id + ' · ' + info.qualities.map((item) => item.label).join(', ')
      + (info.mix?.id ? ' · 合集=' + info.mix.name : ''));
  }

  function showEmpty(message) {
    videoInfo = null;
    setVideoLoading(false);
    titleEl.dataset.i18nUiMessage = '1';
    setUiText(titleEl, message || '请打开单个视频页');
    authorEl.classList.add('hidden');
    setUiText(subEl, '');
    showCover('');
    pillsEl.replaceChildren();
    const tip = document.createElement('span');
    tip.className = 'dy-dl-pill disabled';
    setUiText(tip, '未识别到视频');
    pillsEl.appendChild(tip);
    estimateEl.classList.add('hidden');
    refreshFilenamePreview();
    ui.querySelector('.dy-dl-retry-info').classList.remove('hidden');
    startBtn.disabled = true;
    coverBtn.disabled = true;
    updateMixAvailability(null);
    setStatus('', '');
  }

  function revealDebug() {
    const el = document.getElementById('douyin-dl-debug');
    if (el) el.open = true;
  }

  async function loadVideoInfo() {
    const generation = ++loadGeneration;
    videoLoadPending = true;
    const previousInfo = videoInfo;
    const href = location.href;
    videoInfo = null;
    refreshFilenamePreview();
    estimateEl.classList.add('hidden');
    pageAwemeIdHint = parse.parseAwemeId(href) || '';
    let awemeId = pageAwemeIdHint;
    shell.debug.log('面板', '识别开始 href=' + href);
    shell.debug.log('面板', 'awemeId=' + (awemeId || '空'));
    setVideoLoading(true);
    startBtn.disabled = true;
    coverBtn.disabled = true;
    pillsEl.replaceChildren();
    const loading = document.createElement('span');
    loading.className = 'dy-dl-pill loading';
    setUiText(loading, '加载中');
    pillsEl.appendChild(loading);
    if (!awemeId) {
      try {
        const detected = await agentCall('DETECT_AWEME_ID', { href }, 8000);
        if (generation !== loadGeneration || href !== location.href) return;
        awemeId = detected?.id || '';
        if (awemeId) {
          pageAwemeIdHint = awemeId;
          shell.debug.log('面板', '页面识别 awemeId=' + awemeId);
        }
      } catch (detectError) {
        shell.debug.log('识别', detectError.message || detectError);
      }
    } else {
      pageAwemeIdHint = awemeId;
    }
    try {
      const result = await agentCall('RESOLVE_VIDEO', { href, awemeId }, 35000);
      if (generation !== loadGeneration || href !== location.href) return;
      if (result?.awemeId) pageAwemeIdHint = result.awemeId;
      applyVideoInfo(result.info);
    } catch (error) {
      if (generation !== loadGeneration || href !== location.href) return;
      shell.debug.log('错误', error.message || error);
      const fallbackId = awemeId || pageAwemeIdHint;
      if (previousInfo?.id === fallbackId && previousInfo.qualities?.some((quality) => quality.urls?.length)) {
        applyVideoInfo(previousInfo);
        return;
      }
      if (!fallbackId) {
        showEmpty('请打开单个视频页后再下载');
        shell.debug.log('面板', '当前不是单个视频页');
        revealDebug();
        return;
      }
      try {
        shell.debug.log('兜底', '读取分享页 ' + fallbackId);
        const share = await EXT.runtime.sendMessage({ type: 'DOUYIN_DL_FETCH_SHARE', awemeId: fallbackId });
        if (generation !== loadGeneration || href !== location.href) return;
        if (share?.ok && share.info?.id === fallbackId) {
          pageAwemeIdHint = fallbackId;
          applyVideoInfo(share.info);
          shell.debug.log('兜底', '分享页识别成功');
          return;
        }
        shell.debug.log('兜底', share?.error || '分享页无数据');
      } catch (shareError) {
        shell.debug.log('兜底失败', shareError.message || shareError);
      }
      if (generation !== loadGeneration || href !== location.href) return;
      const message = String(error.message || '识别失败');
      const display = /页面代理超时/.test(message)
        ? '识别超时：请先播放视频几秒，再点面板刷新；或刷新整页后重试'
        : message;
      showEmpty(display);
      revealDebug();
      agentCall('DUMP_STATE', { awemeId }, 5000).then((dump) => {
        shell.debug.log('快照', dump?.state || dump);
      }).catch((dumpError) => {
        shell.debug.log('快照失败', dumpError.message || dumpError);
      });
    } finally {
      if (generation === loadGeneration) videoLoadPending = false;
    }
  }

  function mountJobCard(job, parentEl) {
    const el = document.createElement('div');
    el.className = 'dy-dl-progress dy-dl-job-card';
    el.dataset.jobId = job.jobId;
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
    markStaticUi(el);
    const titleNode = el.querySelector('.dy-dl-progress-title');
    const cardTitle = job.scope === 'list'
      ? shortListLabel(job.info)
      : (job.info?.title || '视频');
    titleNode.textContent = cardTitle;
    titleNode.title = job.info?.title || cardTitle;
    setUiText(el.querySelector('.dy-dl-progress-q'), job.label || '');
    const pauseBtn = el.querySelector('.dy-dl-job-pause');
    const cancelBtn = el.querySelector('.dy-dl-job-cancel');
    const bar = el.querySelector('.dy-dl-progress-bar');
    pauseBtn.onclick = (event) => {
      if (!event.isTrusted) return;
      const current = activeJobs.get(job.jobId);
      if (!current) return;
      if (Number.isInteger(current.downloadId)) {
        client.control(current, current.paused ? 'RESUME' : 'PAUSE').catch((error) => setStatus(error.message, 'error'));
        return;
      }
      if (current.paused) {
        agentSignal('RESUME_DOWNLOAD', { jobId: job.jobId });
        current.paused = false;
        setUiText(pauseBtn, '暂停');
        bar.classList.remove('paused');
      } else {
        agentSignal('PAUSE_DOWNLOAD', { jobId: job.jobId });
        current.paused = true;
        setUiText(pauseBtn, '继续');
        bar.classList.add('paused');
      }
    };
    cancelBtn.onclick = (event) => {
      if (!event.isTrusted) return;
      job.cancelRequested = true;
      agentSignal('CANCEL_DOWNLOAD', { jobId: job.jobId });
      if (Number.isInteger(job.downloadId)) {
        client.control(job, 'CANCEL').catch((error) => setStatus(error.message, 'error'));
      }
    };
    if (job.scope === 'list') {
      const inline = document.createElement('button');
      inline.type = 'button';
      inline.className = 'dy-dl-job-cancel-inline';
      setUiText(inline, '取消');
      el.querySelector('.dy-dl-progress-head').appendChild(inline);
      inline.onclick = (event) => cancelBtn.onclick(event);
    }
    job.cardEl = el;
    const host = parentEl || jobListEl;
    DownloaderKit.i18n?.translateDom?.(el);
    host.appendChild(el);
    host.classList.remove('hidden');
    syncListJobPanel();
    el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
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
      setUiText(pauseBtn, '继续');
      setUiText(phaseEl, '已暂停');
      bar.classList.add('paused');
      syncListJobPanel();
      return;
    }
    if (job.paused) {
      job.paused = false;
      setUiText(pauseBtn, '暂停');
      bar.classList.remove('paused');
      syncListJobPanel();
    }
    const labels = { download: '下载视频', save: '保存到本地' };
    setUiText(phaseEl, labels[step] || '下载中…');
    const recv = Number(received) || 0;
    const tot = Number(total) || 0;
    const pct = tot > 0 ? Math.min(100, Math.round((recv / tot) * 100)) : Math.max(0, Number(percent) || 0);
    if (tot > 0) {
      setUiText(pctEl, parse.formatBytes(recv) + ' / ' + parse.formatBytes(tot));
      bar.style.width = pct + '%';
      bar.classList.remove('indeterminate');
    } else if (pct > 0) {
      setUiText(pctEl, pct + '%');
      bar.style.width = pct + '%';
      bar.classList.remove('indeterminate');
    } else {
      setUiText(pctEl, '');
      bar.classList.add('indeterminate');
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

  function reportJob(job, state) {
    const paused = Boolean(state.paused);
    updateProgress(paused ? 'paused' : 'download', 0, state.bytesReceived, state.totalBytes, job.jobId);
    if (paused && state.canResume === false) {
      const pause = job.cardEl.querySelector('.dy-dl-job-pause');
      if (pause) pause.title = '此地址暂不支持续传，可取消后重试';
    }
  }

  function firefoxDownloadsApi() {
    if (!/Firefox\//i.test(navigator.userAgent || '')) return null;
    const api = globalThis.browser?.downloads || globalThis.chrome?.downloads;
    return typeof api?.download === 'function' ? api : null;
  }

  async function downloadInPage(options) {
    const api = firefoxDownloadsApi();
    if (!api) return null;
    const id = await api.download({
      url: options.url,
      filename: options.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    if (!Number.isInteger(id)) throw new Error('浏览器没有返回下载编号');
    return id;
  }

  async function runDownloadJob(job, options) {
    const listMode = options?.scope === 'list';
    const statusFn = listMode ? setListStatus : setStatus;
    activeJobs.set(job.jobId, job);
    mountJobCard(job, listMode ? listJobListEl : jobListEl);
    if (!listMode) {
      refreshVideoStartBtn();
      setStatus('');
    }
    try {
      shell.debug.log('下载', job.info.id + ' · ' + job.label + ' · 页内取流');
      const result = await agentCall('START_DOWNLOAD', {
        href: job.href,
        qn: job.qn,
        jobId: job.jobId,
        filename: job.filename
      }, 0);
      const filename = job.filename || result.filename;
      let downloadId = null;
      let bytesReceived = 0;
      let savedName = filename;
      if (result.direct) {
        if (job.cancelRequested || queueCancelled) throw new Error('下载已取消');
        shell.debug.log('下载', '页内失败，改浏览器直链');
        job.urls = result.urls || job.urls;
        job.filename = filename;
        if (firefoxDownloadsApi()) {
          let savedDirect = null;
          let lastDirectError;
          for (const mediaUrl of (job.urls || [])) {
            try {
              job.downloadId = await downloadInPage({ url: mediaUrl, filename });
              downloadId = job.downloadId;
              savedDirect = await client.monitor(job, (state) => reportJob(job, state));
              break;
            } catch (error) {
              lastDirectError = error;
              if (job.cancelRequested) throw error;
            }
          }
          if (!savedDirect) throw lastDirectError || new Error('直链下载失败');
          bytesReceived = Number(savedDirect.bytesReceived) || 0;
          savedName = (savedDirect.filename || filename).split(/[/\\]/).pop() || filename;
          await addHistory({
            id: job.info.id, title: job.info.title, author: job.info.author,
            qn: job.qn, label: job.label, href: 'https://www.douyin.com/video/' + job.info.id,
            filename: savedName, downloadId, at: Date.now()
          });
          shell.noteSuccess();
          if (!listMode) setStatus('已保存：' + savedName, 'ok');
          return { ok: true, filename: savedName };
        }
        const saved = await client.download(job, (state) => {
          reportJob(job, state);
          downloadId = job.downloadId;
        }, (index, total, error) => {
          shell.debug.log('重试', '备用地址 ' + index + '/' + total + ' · ' + error.message);
          statusFn('正在尝试备用地址 ' + index + '/' + total);
        });
        downloadId = job.downloadId;
        bytesReceived = Number(saved.bytesReceived) || 0;
        savedName = (saved.filename || filename).split(/[/\\]/).pop() || filename;
      } else {
        if (!result.blob) throw new Error('页内取流没有返回视频数据');
        // 页内已取到完整数据：迟到的取消仍应落盘并计成功。
        updateProgress('save', 95, result.blob.size, result.blob.size, job.jobId);
        const url = URL.createObjectURL(result.blob);
        try {
          const pageDownloadId = await downloadInPage({ url, filename });
          if (pageDownloadId) {
            job.downloadId = pageDownloadId;
            downloadId = pageDownloadId;
          } else {
            const started = await client.request('SAVE_MEDIA', { url, filename });
            job.downloadId = started.downloadId;
            downloadId = started.downloadId;
          }
          const saved = await client.monitor(job, (state) => reportJob(job, state));
          bytesReceived = Number(saved.bytesReceived) || result.blob.size;
          savedName = (saved.filename || filename).split(/[/\\]/).pop() || filename;
        } finally {
          URL.revokeObjectURL(url);
        }
        updateProgress('save', 100, bytesReceived, bytesReceived, job.jobId);
      }
      await addHistory({
        id: job.info.id, title: job.info.title, author: job.info.author,
        qn: job.qn, label: job.label, href: 'https://www.douyin.com/video/' + job.info.id,
        filename: savedName, downloadId, at: Date.now()
      });
      shell.noteSuccess();
      if (!listMode) setStatus('已保存：' + savedName, 'ok');
      shell.debug.log('完成', savedName + ' · ' + parse.formatBytes(bytesReceived || result.blob?.size || 0));
      return { ok: true, filename: savedName };
    } catch (error) {
      const message = error.message === 'USER_CANCELED' ? '下载已取消' : error.message;
      if (!listMode) {
        if (job.cancelRequested || message === '下载已取消') setStatus('');
        else setStatus((message || '下载失败') + '。可刷新页面后重试，或切换清晰度。', 'error');
      }
      shell.debug.log('错误', message || error);
      return { ok: false, cancelled: job.cancelRequested || message === '下载已取消', error: message };
    } finally {
      job.cardEl?.remove();
      activeJobs.delete(job.jobId);
      if (!listMode) {
        if (!videoJobCount()) jobListEl.classList.add('hidden');
        refreshVideoStartBtn();
      } else {
        syncListJobPanel();
      }
    }
  }

  async function startDownload() {
    await settingsReady;
    if (!videoInfo || queueRunning) return;
    if (videoJobCount() >= PARALLEL_MAX) {
      setStatus('最多同时 ' + PARALLEL_MAX + ' 个下载，请等完成后再加', 'error');
      return;
    }
    if (videoInfo.id !== currentAwemeId()) { await loadVideoInfo(); return; }
    const quality = currentQuality();
    if (!quality) return;
    const jobId = 'job-' + Date.now() + '-' + videoJobCount();
    const job = {
      jobId, scope: 'video', info: videoInfo, href: location.href, qn: quality.qn, label: quality.label,
      urls: quality.urls,
      filename: FILENAME.withExtension(FILENAME.renderTemplate(filenameSettings.filenameTemplate, videoInfo, {
        qualityLabel: qualityLabel(quality)
      }), 'mp4'),
      saveAs: false, cancelRequested: false, paused: false
    };
    runDownloadJob(job, { scope: 'video' });
  }

  async function ensureListItemInfo(item) {
    if (item?.qualities?.length) return item;
    const href = 'https://www.douyin.com/video/' + item.id;
    const result = await agentCall('RESOLVE_VIDEO', { href }, 25000);
    if (!result?.info?.qualities?.length) throw new Error('未能识别该集片源');
    return { ...item, ...result.info };
  }

  async function startListDownload() {
    await settingsReady;
    const items = listItems.filter((item) => selectedListIds.has(item.id));
    if (!items.length || queueRunning) return;
    if (activeJobs.size > 0) {
      setListStatus('请先等待当前下载完成，再开始列表下载。', 'error');
      return;
    }
    queueRunning = true;
    queueCancelled = false;
    lastListFailures = [];
    listStartBtn.disabled = true;
    listCancelBtn.classList.remove('hidden');
    setListStatus('');
    updateListSelection();
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    let stoppedByCancel = false;
    try {
      for (let index = 0; index < items.length; index += 1) {
        if (queueCancelled) {
          stoppedByCancel = true;
          skipped = items.length - index;
          break;
        }
        const raw = items[index];
        shell.debug.log('合集', `下载 ${index + 1}/${items.length} · ${shortListLabel(raw)}`);
        setListStatus(`正在下载 ${index + 1}/${items.length}：${shortListLabel(raw)}`);
        let info;
        try {
          info = await ensureListItemInfo(raw);
        } catch (error) {
          if (queueCancelled) {
            stoppedByCancel = true;
            skipped = items.length - index;
            break;
          }
          fail += 1;
          lastListFailures.push(raw);
          shell.debug.log('合集', '识别失败 ' + raw.id + ' · ' + (error.message || error));
          continue;
        }
        if (queueCancelled) {
          stoppedByCancel = true;
          skipped = items.length - index;
          break;
        }
        const qn = pickQnForInfo(info, listSelectedQn);
        const quality = info.qualities.find((item) => item.qn === qn) || info.qualities[0];
        if (!quality) {
          fail += 1;
          lastListFailures.push(raw);
          continue;
        }
        const filename = FILENAME.withExtension(FILENAME.renderTemplate(filenameSettings.filenameTemplate, info, {
          episode: info.episode,
          qualityLabel: qualityLabel(quality)
        }), 'mp4');
        const job = {
          jobId: 'list-' + Date.now() + '-' + index,
          scope: 'list',
          info: { ...info },
          href: 'https://www.douyin.com/video/' + info.id,
          qn: quality.qn,
          label: '列表 · ' + quality.label,
          urls: quality.urls,
          filename,
          saveAs: false,
          cancelRequested: false,
          paused: false
        };
        const result = await runDownloadJob(job, { scope: 'list' });
        if (result?.ok) {
          ok += 1;
          if (queueCancelled) {
            stoppedByCancel = true;
            skipped = items.length - (index + 1);
            break;
          }
          continue;
        }
        // 「取消整队」才中断队列；任务卡「取消」只跳过当前集。
        if (queueCancelled) {
          stoppedByCancel = true;
          skipped = items.length - index;
          break;
        }
        if (result?.cancelled) {
          fail += 1;
          lastListFailures.push(raw);
          shell.debug.log('合集', '已跳过取消的一集 ' + raw.id);
          continue;
        }
        fail += 1;
        lastListFailures.push(raw);
      }
      if (stoppedByCancel) {
        setListStatus(`列表下载已取消：已保存 ${ok} 个，失败 ${fail} 个，未执行 ${skipped} 个`, 'error');
      } else if (fail) {
        setListStatus(`列表下载完成：成功 ${ok} 个，失败 ${fail} 个`, ok ? 'success' : 'error');
      } else {
        setListStatus(`列表下载完成：已保存 ${ok} 个视频`, 'success');
      }
    } finally {
      queueRunning = false;
      queueCancelled = false;
      listCancelBtn.classList.add('hidden');
      refreshVideoStartBtn();
      updateListSelection();
    }
  }

  let coverBusy = false;
  async function downloadCover() {
    await settingsReady;
    if (!videoInfo?.cover || coverBusy) return;
    const info = videoInfo;
    coverBusy = true;
    coverBtn.disabled = true;
    try {
      const filename = FILENAME.renderTemplate(filenameSettings.filenameTemplate, info, { qualityLabel: '封面' });
      const started = await client.request('DOWNLOAD_COVER', {
        url: normalizeCoverUrl(info.cover),
        filename,
        saveAs: false
      });
      setStatus('正在保存封面…');
      await client.monitor({ downloadId: started.downloadId });
      setStatus('封面已保存', 'ok');
    } catch (error) { setStatus(error.message || '封面下载失败', 'error'); }
    finally { coverBusy = false; coverBtn.disabled = !videoInfo?.cover; }
  }

  ui.querySelector('[data-action="downloads"]').onclick = () => client.request('OPEN_DOWNLOADS').catch((error) => setStatus(error.message, 'error'));

  modeTabsEl.querySelectorAll('[data-mode]').forEach((button) => {
    button.onclick = (event) => {
      if (!event.isTrusted) return;
      setDownloadMode(button.dataset.mode).catch((error) => setListStatus(error.message || '切换失败', 'error'));
    };
  });
  listRefreshBtn.onclick = (event) => {
    if (!event.isTrusted || listLoading) return;
    loadListItems(true).catch((error) => setListStatus(error.message || '刷新合集失败', 'error'));
  };
  listLoadMoreBtn.onclick = (event) => {
    if (!event.isTrusted) return;
    loadMoreListItems().catch((error) => setListStatus(error.message || '继续加载失败', 'error'));
  };
  listSelectAllBtn.onclick = (event) => {
    if (!event.isTrusted || queueRunning) return;
    if (selectedListIds.size === listItems.length) selectedListIds = new Set();
    else selectedListIds = new Set(listItems.map((item) => item.id));
    renderListItems();
  };
  listStartBtn.onclick = (event) => {
    if (!event.isTrusted) return;
    startListDownload().catch((error) => setListStatus(error.message || '列表下载失败', 'error'));
  };
  listRetryBtn.onclick = (event) => {
    if (!event.isTrusted || queueRunning || !lastListFailures.length) return;
    selectedListIds = new Set(lastListFailures.map((item) => item.id));
    renderListItems();
    startListDownload().catch((error) => setListStatus(error.message || '列表下载失败', 'error'));
  };
  listPauseBtn.onclick = (event) => {
    if (!event.isTrusted) return;
    const job = [...activeJobs.values()].find((item) => item.scope === 'list');
    const pause = job?.cardEl?.querySelector('.dy-dl-job-pause');
    if (pause) pause.onclick({ isTrusted: true });
    syncListJobPanel();
  };
  listCancelBtn.onclick = (event) => {
    if (!event.isTrusted) return;
    queueCancelled = true;
    [...activeJobs.values()].forEach((job) => {
      if (job.scope !== 'list') return;
      job.cancelRequested = true;
      agentSignal('CANCEL_DOWNLOAD', { jobId: job.jobId });
      if (Number.isInteger(job.downloadId)) {
        client.control(job, 'CANCEL').catch(() => {});
      }
    });
    setListStatus('正在取消列表下载…');
  };

  window.addEventListener('message', (event) => {
    if (!event?.data || event.data.source !== AGENT) return;
    if (event.origin && event.origin !== location.origin) return;
    const { id, type, step, msg, data, error } = event.data;
    if (type === 'LOG') {
      shell.debug.log(step, msg);
      return;
    }
    if (type === 'LOCATION') {
      if (event.data.href) {
        clearTimeout(recoveryTimer);
        recoveryAttempts = 0;
        listLoadGeneration += 1;
        listLoaded = false;
        listLoading = false;
        listItems = [];
        selectedListIds = new Set();
        currentMixId = '';
        if (activeMode === 'list') activeMode = 'video';
        syncModeTabs();
        loadVideoInfo();
      }
      return;
    }
    if (type === 'VIDEO_AVAILABLE') {
      const info = data?.info;
      const wanted = parse.parseAwemeId(location.href) || pageAwemeIdHint;
      if (!wanted || info?.id !== wanted || videoInfo?.id === wanted) return;
      try {
        applyVideoInfo(info);
        loadGeneration += 1;
        videoLoadPending = false;
        recoveryAttempts = 0;
      } catch (_) { /* Wait for a complete source instead of accepting metadata. */ }
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
    const id = currentAwemeId();
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
          sub: formatPopupSub(videoInfo),
          qualities: displayQualities(videoInfo.qualities).map((item) => item.label).filter(Boolean)
        } : {
          title: '正在识别当前视频',
          sub: '请稍候…'
        }
      }
    });
    return undefined;
  });

  startBtn.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    startDownload().catch((error) => setStatus(error.message || '下载失败', 'error'));
  });
  ui.querySelector('.dy-dl-retry-info').addEventListener('click', (event) => {
    if (event.isTrusted && !videoLoadPending) loadVideoInfo();
  });
  function recoverOnPlayback(event) {
    if (event.target?.tagName !== 'VIDEO' || videoInfo || videoLoadPending || recoveryAttempts >= 3) return;
    clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      if (videoInfo || videoLoadPending) return;
      recoveryAttempts += 1;
      loadVideoInfo();
    }, 150);
  }
  document.addEventListener('loadedmetadata', recoverOnPlayback, true);
  document.addEventListener('canplay', recoverOnPlayback, true);
  coverBtn.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    downloadCover().catch((error) => setStatus(error.message || '封面下载失败', 'error'));
  });
  function localizePanel() {
    DownloaderKit.i18n?.translateDom?.(ui);
    refreshVideoStartBtn();
    refreshFilenamePreview();
    refreshEstimate();
    updateListSelection();
    updateListLoadMore();
    syncListJobPanel();
    if (listItems.length) renderListItems();
    if (videoInfo) {
      const parts = [];
      if (videoInfo.playCount) parts.push(parse.formatCount(videoInfo.playCount) + ' ' + t('play'));
      if (videoInfo.createTime) parts.push(formatRelativeTime(videoInfo.createTime));
      setUiText(subEl, parts.length ? parts.join(' · ') : '抖音视频');
    }
  }
  DownloaderKit.i18n?.ready?.then(localizePanel);
  DownloaderKit.i18n?.onChange?.(localizePanel);
  agentCall('FLUSH_LOGS', {}, 3000).catch(() => {});
  ensureAgentReady().then((ready) => {
    if (!ready) {
      showEmpty('页面代理未就绪，请刷新页面后重试');
      return;
    }
    shell.debug.log('代理', '就绪');
    loadVideoInfo();
  });
  shell.debug.log('面板已就绪');

  const fabPanel = document.getElementById('douyin-dl-panel');
  const toggleBtn = document.getElementById('douyin-dl-toggle');
  if (fabPanel && toggleBtn) {
    let toggleDragged = false;
    let dragActive = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragPanelLeft = 0;
    let dragPanelTop = 0;
    let dragMoved = false;
    let dragPointerId = null;
    const FAB_SIZE = 64;
    const FAB_MARGIN = 8;
    const FAB_POS_KEY = 'douyinDlFabPos';

    function clampFabPos(left, top) {
      const maxL = Math.max(FAB_MARGIN, window.innerWidth - FAB_SIZE - FAB_MARGIN);
      const maxT = Math.max(FAB_MARGIN, window.innerHeight - FAB_SIZE - FAB_MARGIN);
      return {
        left: Math.min(Math.max(left, FAB_MARGIN), maxL),
        top: Math.min(Math.max(top, FAB_MARGIN), maxT)
      };
    }

    function applyFabPos(left, top) {
      const pos = clampFabPos(left, top);
      fabPanel.style.left = pos.left + 'px';
      fabPanel.style.top = pos.top + 'px';
      fabPanel.style.right = 'auto';
      fabPanel.style.bottom = 'auto';
      return pos;
    }

    function onFabPointerMove(event) {
      if (!dragActive || event.pointerId !== dragPointerId) return;
      const dx = event.clientX - dragStartX;
      const dy = event.clientY - dragStartY;
      if (!dragMoved && Math.abs(dx) + Math.abs(dy) > 6) {
        dragMoved = true;
        toggleDragged = true;
        toggleBtn.classList.add('dragging');
      }
      if (dragMoved) {
        event.preventDefault();
        applyFabPos(dragPanelLeft + dx, dragPanelTop + dy);
      }
    }

    function onFabPointerUp(event) {
      if (!dragActive || event.pointerId !== dragPointerId) return;
      dragActive = false;
      dragPointerId = null;
      document.removeEventListener('pointermove', onFabPointerMove, true);
      document.removeEventListener('pointerup', onFabPointerUp, true);
      document.removeEventListener('pointercancel', onFabPointerUp, true);
      toggleBtn.classList.remove('dragging');
      if (dragMoved) {
        const rect = fabPanel.getBoundingClientRect();
        const pos = applyFabPos(rect.left, rect.top);
        storageSet({ [FAB_POS_KEY]: pos }).catch(() => {});
      }
      setTimeout(() => { toggleDragged = false; }, 120);
    }

    toggleBtn.addEventListener('click', (event) => {
      if (!toggleDragged) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    toggleBtn.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragActive = true;
      dragMoved = false;
      toggleDragged = false;
      dragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      const rect = fabPanel.getBoundingClientRect();
      dragPanelLeft = rect.right - FAB_SIZE;
      dragPanelTop = rect.bottom - FAB_SIZE;
      if (fabPanel.style.left && fabPanel.style.left !== 'auto') {
        dragPanelLeft = parseFloat(fabPanel.style.left) || dragPanelLeft;
        dragPanelTop = parseFloat(fabPanel.style.top) || dragPanelTop;
      }
      applyFabPos(dragPanelLeft, dragPanelTop);
      document.addEventListener('pointermove', onFabPointerMove, true);
      document.addEventListener('pointerup', onFabPointerUp, true);
      document.addEventListener('pointercancel', onFabPointerUp, true);
    });
    toggleBtn.addEventListener('dragstart', (event) => event.preventDefault());
    storageGet(FAB_POS_KEY).then((data) => {
      const pos = data?.[FAB_POS_KEY];
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) applyFabPos(pos.left, pos.top);
    }).catch(() => {});
    let fabResizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(fabResizeTimer);
      fabResizeTimer = setTimeout(() => {
        const left = parseFloat(fabPanel.style.left);
        const top = parseFloat(fabPanel.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        const pos = applyFabPos(left, top);
        storageSet({ [FAB_POS_KEY]: pos }).catch(() => {});
      }, 100);
    });
  }
})();
