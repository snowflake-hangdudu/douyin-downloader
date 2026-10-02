(function initPanel(root, factory) {
  const api = factory();
  root.DownloaderKit = root.DownloaderKit || {};
  root.DownloaderKit.panel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function panelFactory() {
  function create(options) {
    const opts = options || {};
    const doc = opts.document || globalThis.document;
    if (!doc?.body) throw new Error('document.body is required');
    const dom = opts.dom || globalThis.DownloaderKit?.dom;
    if (!dom) throw new Error('DownloaderKit.dom is required');

    const idPrefix = opts.idPrefix || 'dl-kit';
    const i18n = globalThis.DownloaderKit?.i18n;
    const tr = (key, values) => i18n?.t?.(key, values) || key;
    const titleSource = opts.title || '下载助手';
    const title = i18n?.translateText?.(titleSource) || titleSource;
    const iconUrl = String(opts.iconUrl || '');
    const footer = opts.footer || {};

    const rootEl = doc.createElement('div');
    rootEl.className = 'dl-kit';
    rootEl.id = idPrefix + '-root';
    rootEl.dataset.theme = opts.theme || 'default';
    rootEl.dataset.debug = opts.showDebug ? '1' : '0';

    const wrap = doc.createElement('div');
    wrap.className = 'dl-kit-panel';
    wrap.id = idPrefix + '-panel';

    const fab = doc.createElement('button');
    fab.type = 'button';
    fab.className = 'dl-kit-toggle';
    fab.id = idPrefix + '-toggle';
    fab.title = title;
    fab.setAttribute('aria-expanded', 'false');
    if (iconUrl) {
      const icon = doc.createElement('img');
      icon.src = iconUrl;
      icon.alt = '';
      fab.appendChild(icon);
    } else {
      fab.textContent = opts.fabLabel || '保存';
    }

    const menu = doc.createElement('div');
    menu.className = 'dl-kit-menu hidden';
    menu.id = idPrefix + '-menu';
    menu.setAttribute('aria-label', title);

    const header = doc.createElement('div');
    header.className = 'dl-kit-header';
    const headerLeft = doc.createElement('div');
    headerLeft.className = 'dl-kit-header-left';
    if (iconUrl) {
      const headerIcon = doc.createElement('img');
      headerIcon.className = 'dl-kit-header-icon';
      headerIcon.src = iconUrl;
      headerIcon.width = 22;
      headerIcon.height = 22;
      headerIcon.alt = '';
      headerLeft.appendChild(headerIcon);
    }
    dom.appendTextElement(headerLeft, 'span', 'dl-kit-title', title);
    const version = dom.appendTextElement(headerLeft, 'span', 'dl-kit-version', opts.version ? 'v' + opts.version : '');
    if (!opts.version) version.hidden = true;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'dl-kit-close';
    close.id = idPrefix + '-close';
    close.setAttribute('aria-label', tr('close'));
    close.textContent = '×';
    header.append(headerLeft, close);

    const body = doc.createElement('div');
    body.className = 'dl-kit-body';
    const home = doc.createElement('div');
    home.className = 'dl-kit-home';
    home.id = idPrefix + '-home';
    const page = doc.createElement('div');
    page.className = 'dl-kit-page hidden';
    page.id = idPrefix + '-page';

    const pageBack = doc.createElement('button');
    pageBack.type = 'button';
    pageBack.className = 'dl-kit-page-back';
    pageBack.textContent = opts.backLabel ? (i18n?.translateText?.(opts.backLabel) || opts.backLabel) : tr('backToDownload');
    const pageTitle = dom.appendTextElement(page, 'div', 'dl-kit-page-title', '');
    pageTitle.id = idPrefix + '-info-title';
    const pageDate = dom.appendTextElement(page, 'div', 'dl-kit-info-date', '');
    pageDate.id = idPrefix + '-info-date';
    pageDate.hidden = true;
    const pageBody = doc.createElement('div');
    pageBody.className = 'dl-kit-info-body';
    pageBody.id = idPrefix + '-info-body';
    page.prepend(pageBack);
    page.append(pageTitle, pageDate, pageBody);

    let debugEl = null;
    if (opts.showDebug) {
      debugEl = doc.createElement('details');
      debugEl.className = 'dl-kit-debug';
      debugEl.id = idPrefix + '-debug';
      debugEl.open = false;
      const summary = doc.createElement('summary');
      summary.className = 'dl-kit-debug-summary';
      dom.appendTextElement(summary, 'span', '', '调试日志');
      const debugCount = dom.appendTextElement(summary, 'span', 'dl-kit-debug-count', '0');
      debugCount.id = idPrefix + '-debug-count';
      const debugActions = doc.createElement('div');
      debugActions.className = 'dl-kit-debug-actions';
      const debugCopy = doc.createElement('button');
      debugCopy.type = 'button';
      debugCopy.id = idPrefix + '-debug-copy';
      debugCopy.className = 'dl-kit-debug-btn';
      debugCopy.textContent = '复制';
      const debugClear = doc.createElement('button');
      debugClear.type = 'button';
      debugClear.id = idPrefix + '-debug-clear';
      debugClear.className = 'dl-kit-debug-btn';
      debugClear.textContent = '清空';
      debugActions.append(debugCopy, debugClear);
      const debugLog = doc.createElement('pre');
      debugLog.id = idPrefix + '-debug-log';
      debugLog.className = 'dl-kit-debug-log';
      debugEl.append(summary, debugActions, debugLog);
    }

    body.append(home);
    if (debugEl) body.append(debugEl);

    const rating = doc.createElement('div');
    rating.className = 'dl-kit-store-rating hidden';
    rating.id = idPrefix + '-store-rating';
    rating.setAttribute('role', 'note');
    dom.appendTextElement(rating, 'div', 'dl-kit-store-rating-title', tr('ratingTitle'));
    const ratingText = dom.appendTextElement(rating, 'div', 'dl-kit-store-rating-text', tr('ratingText', { store: '' }));
    const ratingPrimary = doc.createElement('button');
    ratingPrimary.type = 'button';
    ratingPrimary.className = 'dl-kit-store-rating-primary';
    ratingPrimary.dataset.action = 'rate';
    ratingPrimary.textContent = tr('rateStore', { store: '' });
    const ratingActions = doc.createElement('div');
    ratingActions.className = 'dl-kit-store-rating-actions';
    const ratingLater = doc.createElement('button');
    ratingLater.type = 'button';
    ratingLater.className = 'dl-kit-store-rating-ghost';
    ratingLater.dataset.action = 'later';
    ratingLater.textContent = tr('later');
    const ratingNever = doc.createElement('button');
    ratingNever.type = 'button';
    ratingNever.className = 'dl-kit-store-rating-ghost';
    ratingNever.dataset.action = 'never';
    ratingNever.textContent = tr('never');
    ratingActions.append(ratingLater, ratingNever);
    rating.append(ratingPrimary, ratingActions);

    const ICONS = {
      notice: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h1l6 4V6L5 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
      settings: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></svg>',
      feedback: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      donate: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>'
    };

    function footerAction(key, label, icon) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'dl-kit-footer-action';
      if (key) btn.dataset.sheet = key;
      if (icon) btn.insertAdjacentHTML('afterbegin', icon);
      const text = doc.createElement('span');
      text.className = 'dl-kit-footer-label';
      i18n?.setText?.(text, label) || (text.textContent = label);
      btn.appendChild(text);
      return btn;
    }

    function externalLink(href, label) {
      const a = doc.createElement('a');
      a.className = 'dl-kit-footer-action';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const text = doc.createElement('span');
      text.className = 'dl-kit-footer-label';
      i18n?.setText?.(text, label) || (text.textContent = label);
      a.appendChild(text);
      if (href) dom.safeExternalLink(a, href);
      return a;
    }

    const footerEl = doc.createElement('div');
    footerEl.className = 'dl-kit-footer';
    const links = doc.createElement('div');
    links.className = 'dl-kit-footer-links';
    const noticeLink = footerAction('notice', footer.noticeLabel || tr('notice'), ICONS.notice);
    const settingsLink = footerAction('settings', footer.settingsLabel || tr('settings'), ICONS.settings);
    const email = footer.email || 'hangdudu0@agent.qq.com';
    const subject = footer.subject || (title + '反馈');
    const feedback = doc.createElement(footer.feedbackMode === 'copy' ? 'button' : 'a');
    feedback.className = 'dl-kit-footer-action dl-kit-feedback';
    if (footer.feedbackMode === 'copy') {
      feedback.type = 'button';
      feedback.dataset.feedbackEmail = email;
      feedback.title = tr('copyFeedbackEmail', { email });
      feedback.insertAdjacentHTML('afterbegin', ICONS.feedback);
      const feedbackLabel = doc.createElement('span');
      feedbackLabel.className = 'dl-kit-feedback-label';
      i18n?.setText?.(feedbackLabel, footer.feedbackShortLabel || '反馈') || (feedbackLabel.textContent = footer.feedbackShortLabel || tr('feedback'));
      feedback.appendChild(feedbackLabel);
    } else {
      dom.safeExternalLink(feedback, 'mailto:' + email + '?subject=' + encodeURIComponent(subject));
      feedback.textContent = footer.feedbackLabel || tr('feedbackEmail', { email });
    }
    if (footer.showNotice !== false) links.append(noticeLink);
    if (footer.showSettings === true) links.append(settingsLink);
    if (footer.showHelpLinks !== false) {
      links.append(externalLink(footer.faqUrl, footer.faqLabel || tr('faq')));
      links.append(externalLink(footer.privacyUrl, footer.privacyLabel || tr('privacy')));
    }
    links.append(feedback);
    if (footer.showDonate) {
      const donateLink = footerAction('donate', footer.donateLabel || tr('donate'), ICONS.donate);
      links.append(donateLink);
    }
    footerEl.append(links);

    menu.append(header, body, page, rating, footerEl);
    wrap.append(fab, menu);
    rootEl.appendChild(wrap);

    function isOpen() {
      return !menu.classList.contains('hidden');
    }

    function open() {
      menu.classList.remove('hidden');
      fab.setAttribute('aria-expanded', 'true');
      close.focus?.({ preventScroll: true });
    }

    function hide() {
      menu.classList.add('hidden');
      fab.setAttribute('aria-expanded', 'false');
      showHome();
      fab.focus?.({ preventScroll: true });
    }

    function toggle() {
      if (isOpen()) hide();
      else open();
    }

    function showHome() {
      page.classList.add('hidden');
      body.classList.remove('hidden');
      home.classList.remove('hidden');
      menu.classList.remove('is-page');
      opts.onShowHome?.();
    }

    function openSheet(key, item) {
      const data = item || {};
      pageTitle.textContent = data.title ? (i18n?.translateText?.(data.title) || data.title) : (key === 'settings' ? tr('settings') : tr('notice'));
      if (data.subtitle) {
        pageDate.textContent = data.subtitle;
        pageDate.hidden = false;
      } else if (data.updated) {
        pageDate.textContent = tr('updateAt', { value: data.updated });
        pageDate.hidden = false;
      } else {
        pageDate.textContent = '';
        pageDate.hidden = true;
      }
      dom.clearNode(pageBody);
      if (typeof opts.onFillSheet === 'function') opts.onFillSheet(pageBody, key, data);
      else dom.fillTextLines(pageBody, data.body || '暂无内容');
      body.classList.add('hidden');
      page.classList.remove('hidden');
      menu.classList.add('is-page');
      open();
    }

    function setSheetEnabled(key, enabled) {
      footerEl.querySelectorAll('[data-sheet="' + key + '"]').forEach((el) => {
        el.hidden = !enabled;
      });
    }

    function setRating(state) {
      const next = state || {};
      const label = next.storeLabel || 'Edge';
      rating.dataset.storeLabel = label;
      ratingText.textContent = tr('ratingText', { store: label });
      ratingPrimary.textContent = tr('rateStore', { store: label });
      rating.classList.toggle('hidden', !next.visible);
    }

    fab.addEventListener('click', toggle);
    close.addEventListener('click', hide);
    pageBack.addEventListener('click', showHome);
    const onKeydown = (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      event.preventDefault();
      if (!page.classList.contains('hidden')) {
        showHome();
        return;
      }
      hide();
    };
    doc.addEventListener('keydown', onKeydown);
    footerEl.querySelectorAll('[data-sheet]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        opts.onOpenSheet?.(btn.dataset.sheet);
      });
    });
    if (footer.feedbackMode === 'copy') {
      feedback.addEventListener('click', (event) => {
        event.preventDefault();
        if (!event.isTrusted) return;
        opts.onFeedback?.(email, feedback);
      });
    }
    rating.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => opts.onRatingAction?.(btn.dataset.action));
    });
    doc.body.appendChild(rootEl);
    function applyLanguage() {
      if (!i18n) return;
      const text = (selector, value) => {
        const element = rootEl.querySelector(selector);
        if (element) element.textContent = value;
      };
      const attr = (selector, name, value) => {
        const element = rootEl.querySelector(selector);
        if (element) element.setAttribute(name, value);
      };
      i18n.translateDom(rootEl);
      text('.dl-kit-title', i18n.translateText?.(titleSource) || titleSource);
      text('.dl-kit-page-back', tr('backToDownload'));
      attr('.dl-kit-close', 'aria-label', tr('close'));
      attr('.dl-kit-menu', 'aria-label', i18n.translateText?.(titleSource) || titleSource);
      attr('.dl-kit-toggle', 'title', i18n.translateText?.(titleSource) || titleSource);
      text('.dl-kit-store-rating-title', tr('ratingTitle'));
      const storeLabel = rating.dataset.storeLabel || 'Edge';
      text('.dl-kit-store-rating-text', tr('ratingText', { store: storeLabel }));
      text('.dl-kit-store-rating-primary', tr('rateStore', { store: storeLabel }));
      text('[data-action="later"]', tr('later'));
      text('[data-action="never"]', tr('never'));
      if (!footer.noticeLabel) text('[data-sheet="notice"] .dl-kit-footer-label', tr('notice'));
      if (!footer.settingsLabel) text('[data-sheet="settings"] .dl-kit-footer-label', tr('settings'));
      if (!footer.feedbackShortLabel) text('.dl-kit-feedback-label', tr('feedback'));
      if (footer.feedbackMode === 'copy') attr('.dl-kit-feedback', 'title', tr('copyFeedbackEmail', { email }));
      else if (!footer.feedbackLabel) text('.dl-kit-feedback', tr('feedbackEmail', { email }));
      if (!footer.donateLabel) text('[data-sheet="donate"] .dl-kit-footer-label', tr('donate'));
    }
    const offLanguageChange = i18n?.onChange?.(applyLanguage);
    i18n?.ready?.then?.(applyLanguage)?.catch?.(() => {});

    return {
      root: rootEl,
      home,
      open,
      hide,
      toggle,
      isOpen,
      showHome,
      openSheet,
      setSheetEnabled,
      setRating,
      destroy: () => {
        doc.removeEventListener('keydown', onKeydown);
        offLanguageChange?.();
        rootEl.remove();
      }
    };
  }

  return { create };
});
