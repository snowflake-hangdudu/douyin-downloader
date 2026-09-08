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
    const title = opts.title || '下载助手';
    const iconUrl = String(opts.iconUrl || '');
    const footer = opts.footer || {};

    const rootEl = doc.createElement('div');
    rootEl.className = 'dl-kit';
    rootEl.id = idPrefix + '-root';

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
    close.setAttribute('aria-label', '关闭');
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
    pageBack.textContent = opts.backLabel || '返回下载';
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
    body.append(page);

    const rating = doc.createElement('div');
    rating.className = 'dl-kit-store-rating hidden';
    rating.id = idPrefix + '-store-rating';
    rating.setAttribute('role', 'note');
    dom.appendTextElement(rating, 'div', 'dl-kit-store-rating-title', '下载搞定 ⭐ 给个好评呗');
    const ratingText = dom.appendTextElement(rating, 'div', 'dl-kit-store-rating-text', '用着顺手的话，去商店点个分。');
    const ratingPrimary = doc.createElement('button');
    ratingPrimary.type = 'button';
    ratingPrimary.className = 'dl-kit-store-rating-primary';
    ratingPrimary.dataset.action = 'rate';
    ratingPrimary.textContent = '去商店评分 ⭐';
    const ratingActions = doc.createElement('div');
    ratingActions.className = 'dl-kit-store-rating-actions';
    const ratingLater = doc.createElement('button');
    ratingLater.type = 'button';
    ratingLater.className = 'dl-kit-store-rating-ghost';
    ratingLater.dataset.action = 'later';
    ratingLater.textContent = '下次再说';
    const ratingNever = doc.createElement('button');
    ratingNever.type = 'button';
    ratingNever.className = 'dl-kit-store-rating-ghost';
    ratingNever.dataset.action = 'never';
    ratingNever.textContent = '别再问了';
    ratingActions.append(ratingLater, ratingNever);
    rating.append(ratingPrimary, ratingActions);

    function sheetLink(key, label) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'dl-kit-footer-link';
      btn.dataset.sheet = key;
      btn.textContent = label;
      return btn;
    }

    function externalLink(href, label) {
      const a = doc.createElement('a');
      a.className = 'dl-kit-footer-link';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = label;
      if (href) dom.safeExternalLink(a, href);
      return a;
    }

    const footerEl = doc.createElement('div');
    footerEl.className = 'dl-kit-footer';
    const links = doc.createElement('div');
    links.className = 'dl-kit-footer-links';
    const faqLink = externalLink(footer.faqUrl, footer.faqLabel || '常见问题');
    const privacyLink = externalLink(footer.privacyUrl, footer.privacyLabel || '隐私政策');
    const noticeLink = sheetLink('notice', footer.noticeLabel || '公告');
    const coopLink = sheetLink('coop', footer.coopLabel || '开发合作');
    const feedback = doc.createElement('a');
    feedback.className = 'dl-kit-feedback';
    const email = footer.email || 'hangdudu0@agent.qq.com';
    const subject = footer.subject || (title + '反馈');
    feedback.textContent = (footer.feedbackLabel || '反馈邮箱：') + email;
    dom.safeExternalLink(feedback, 'mailto:' + email + '?subject=' + encodeURIComponent(subject));
    links.append(faqLink, privacyLink, noticeLink, coopLink, feedback);
    footerEl.append(links);

    menu.append(header, body, rating, footerEl);
    wrap.append(fab, menu);
    rootEl.appendChild(wrap);

    function isOpen() {
      return !menu.classList.contains('hidden');
    }

    function open() {
      menu.classList.remove('hidden');
      fab.setAttribute('aria-expanded', 'true');
    }

    function hide() {
      menu.classList.add('hidden');
      fab.setAttribute('aria-expanded', 'false');
      showHome();
    }

    function toggle() {
      if (isOpen()) hide();
      else open();
    }

    function showHome() {
      page.classList.add('hidden');
      home.classList.remove('hidden');
      menu.classList.remove('is-page');
      opts.onShowHome?.();
    }

    function openSheet(key, item) {
      const data = item || {};
      pageTitle.textContent = data.title || (key === 'coop' ? '开发合作' : '公告');
      if (data.updated) {
        pageDate.textContent = '更新：' + data.updated;
        pageDate.hidden = false;
      } else {
        pageDate.textContent = '';
        pageDate.hidden = true;
      }
      dom.clearNode(pageBody);
      if (typeof opts.onFillSheet === 'function') opts.onFillSheet(pageBody, key, data);
      else dom.fillTextLines(pageBody, data.body || '暂无内容');
      home.classList.add('hidden');
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
      ratingText.textContent = '用着顺手的话，去 ' + label + ' 商店点个分。';
      ratingPrimary.textContent = '去 ' + label + ' 商店评分 ⭐';
      rating.classList.toggle('hidden', !next.visible);
    }

    fab.addEventListener('click', toggle);
    close.addEventListener('click', hide);
    pageBack.addEventListener('click', showHome);
    footerEl.querySelectorAll('[data-sheet]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        opts.onOpenSheet?.(btn.dataset.sheet);
      });
    });
    rating.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => opts.onRatingAction?.(btn.dataset.action));
    });
    doc.body.appendChild(rootEl);

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
      destroy: () => rootEl.remove()
    };
  }

  return { create };
});
