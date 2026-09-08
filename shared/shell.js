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
      version,
      iconUrl: opts.iconUrl || api.runtime.getURL('icons/icon128.png'),
      fabLabel: opts.fabLabel,
      backLabel: opts.backLabel,
      footer: opts.footer,
      showDebug,
      onOpenSheet: openSheet,
      onShowHome() { currentSheet = ''; },
      onFillSheet(body, key, data) {
        if (key === 'notice') kit.notice.fillNoticeBody(body, data);
        else kit.dom.fillTextLines(body, data.body || '暂无内容');
      },
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
      panel.setSheetEnabled('notice', remoteContent.notice?.enabled !== false);
      panel.setSheetEnabled('coop', remoteContent.coop?.enabled !== false);
      if (!rating.enabled()) panel.setRating({ visible: false });
    }

    function openSheet(key) {
      currentSheet = key;
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
        openSheet(message.sheet === 'coop' ? 'coop' : 'notice');
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
