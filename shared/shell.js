(function initShell(root, factory) {
  const api = factory();
  root.DownloaderKit = root.DownloaderKit || {};
  root.DownloaderKit.shell = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function shellFactory() {
  function mount(options) {
    const opts = options || {};
    const kit = globalThis.DownloaderKit;
    const runtime = kit.runtime;
    const version = opts.version || runtime.getVersion();
    const api = runtime.getApi();
    const defaults = kit.remote.mergeRemoteContent({}, opts.defaults);
    let remoteContent = defaults;
    let currentSheet = '';
    const showDebug = kit.debug.isEnabled(opts.showDebug, api);

    const panel = kit.panel.create({
      title: opts.title,
      idPrefix: opts.idPrefix,
      theme: opts.theme,
      version,
      iconUrl: opts.iconUrl || api.runtime.getURL('icons/icon128.png'),
      fabLabel: opts.fabLabel,
      backLabel: opts.backLabel,
      // Announcements are intentionally disabled for this product. Remote
      // content may still be fetched for other sections, but cannot add it back.
      footer: { ...(opts.footer || {}), showNotice: false },
      showDebug,
      onOpenSheet: openSheet,
      onShowHome() { currentSheet = ''; },
      onFillSheet(body, key, data) {
        if (key === 'notice') {
          kit.notice.fillNoticeBody(body, data, { coop: remoteContent.coop });
        } else if (key === 'settings') {
          opts.onFillSettings?.(body, data);
        } else if (key === 'donate') {
          opts.onFillDonate?.(body);
        } else {
          kit.dom.fillTextLines(body, data.body || '暂无内容');
        }
      },
      onFeedback: opts.onFeedback,
      onRatingAction: (action) => rating.handleAction(action)
    });

    const debug = kit.debug.create({
      enabled: showDebug,
      idPrefix: opts.idPrefix,
      logTag: opts.debugTag || opts.title || 'DLKIT',
      api
    });
    debug.bind();

    const rating = kit.rating.createController({
      runtime,
      storageKey: opts.ratingKey || 'downloadKitStoreRating',
      getRating: () => remoteContent.rating,
      getVersion: () => version,
      onVisible(visible, storeLabel) {
        panel.setRating({ visible, storeLabel });
      }
    });

    async function loadRemote() {
      try {
        remoteContent = await kit.remote.loadRemoteContent({
          runtime,
          configUrl: opts.configUrl,
          messageType: opts.messageType,
          cacheKey: opts.cacheKey || 'downloadKitRemoteContent',
          defaults
        });
      } catch (_) {
        remoteContent = defaults;
      }
      applyRemoteButtons();
      return remoteContent;
    }

    function applyRemoteButtons() {
      panel.setSheetEnabled('notice', false);
      if (!rating.enabled()) panel.setRating({ visible: false });
    }

    function openSheet(key) {
      if (key === 'coop') key = 'notice';
      if (key === 'notice') return;
      if (key === 'donate') {
        currentSheet = key;
        panel.openSheet(key, { title: kit.i18n?.t?.('thanks') || '感谢您的支持与赞赏' });
        return;
      }
      currentSheet = key;
      if (key === 'settings') {
        const translate = kit.i18n?.t;
        panel.openSheet(key, {
          title: translate ? translate('settings') : '设置',
          subtitle: translate ? translate('settingsHint') : '主题与文件名会同步到下载面板'
        });
        return;
      }
      panel.openSheet(key, remoteContent[key] || defaults[key]);
      loadRemote().then((data) => {
        if (currentSheet === key) panel.openSheet(key, data[key] || defaults[key]);
      });
    }

    const messages = opts.messages || {};
    api.runtime.onMessage.addListener((message) => {
      if (message?.type === messages.openPanel || message?.type === 'DOWNLOADER_OPEN_PANEL') {
        panel.open();
        return undefined;
      }
      if (message?.type === messages.openSheet) {
        panel.open();
        openSheet(message.sheet === 'settings' ? 'settings' : 'notice');
      }
      return undefined;
    });

    loadRemote();

    return {
      panel,
      home: panel.home,
      debug,
      rating,
      loadRemote,
      noteSuccess: () => rating.noteSuccess(),
      open: () => panel.open(),
      hide: () => panel.hide(),
      showHome: () => panel.showHome(),
      openSheet,
      destroy: () => panel.destroy()
    };
  }

  return { mount };
});
