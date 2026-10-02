(function initI18n(root) {
  const kit = root.DownloaderKit = root.DownloaderKit || {};
  const KEY = 'douyin-dl-language-v1';
  const messages = {
    'zh-CN': {
      settings: '设置',
      settingsHint: '主题与文件名会同步到下载面板',
      language: '语言',
      english: 'English',
      chinese: '中文',
      theme: '主题色',
      themeSaved: '主题已保存',
      themeSaveFailed: '主题保存失败',
      'theme-douyin': '默认',
      'theme-tokyo-love': '东爱主题',
      'theme-manchester-sea': '海边的曼彻斯特',
      'theme-chinese-odyssey': '大话西游',
      filename: '文件名',
      filenameRule: '文件名规则',
      presetTitle: '默认（仅标题）',
      presetTitleId: '标题 + 视频 ID',
      presetTitleIdQuality: '标题 + 视频 ID + 清晰度',
      presetDetailed: '标题 + 作者 + 视频 ID + 清晰度',
      presetCustom: '自定义…',
      customTemplate: '自定义文件名模板',
      insertField: '插入变量',
      chipTitle: '标题',
      chipAuthor: '作者',
      chipId: '视频 ID',
      chipEpisode: '合集集数',
      chipQuality: '清晰度',
      chipDate: '日期',
      previewPrefix: '预览：',
      templateInvalid: '模板无效',
      templateEmpty: '文件名模板不能为空',
      templatePath: '模板不能包含路径分隔符',
      unknownField: '未知变量：',
      saved: '已保存',
      saveFailed: '保存失败',
      resetFilename: '恢复默认文件名',
      filenameReset: '已恢复默认文件名',
      resetFailed: '恢复失败',
      sampleTitle: '示例视频标题',
      sampleAuthor: '示例作者',
      extensionTitle: '抖音视频下载助手', close: '关闭', backToDownload: '返回下载', debugLog: '调试日志', copy: '复制', clear: '清空',
      notice: '公告', feedback: '反馈', donate: '赞赏', faq: '常见问题', privacy: '隐私政策',
      loadingPage: '正在识别页面…', quality: '清晰度', openDownloadPanel: '打开下载面板', guide: '抖音下载指引',
      openVideoFirst: '请先打开抖音视频', openVideoLead: '打开单个视频页，或在搜索、推荐里点开一条后再保存。',
      personalUse: '仅供个人学习。请遵守抖音平台规则。', loadingFailed: '加载失败', cannotReadInfo: '暂时无法读取视频信息',
      refreshHint: '请在视频页按 F5 刷新后，再点击扩展图标。', refreshRetry: '刷新并重试', openSite: '打开抖音',
      saveInPanel: '实际保存请点页面右下角图标打开的面板', refreshAfterInstall: '安装或更新后请先 F5 刷新当前视频页',
      openRefresh: '打开单个视频页，或在搜索、推荐里点开一条，然后按 F5', openFloatingPanel: '点击页面右下角悬浮按钮打开面板',
      personalScope: '只保存当前已经能播放的公开视频、封面和合集。不支持会员、付费和直播。',
      collectionTip: '带合集的视频可切换「列表下载」批量保存', collectionStep: '单视频选清晰度保存；合集先打开右侧「合集」，再切「列表下载」',
      unableReadPage: '无法读取页面，请先 F5', unableOpenPanel: '无法打开面板，请刷新页面', unableRefresh: '无法刷新页面，请手动 F5', currentContent: '当前内容', openWebsite: '打开网站',
      currentPage: '当前页面：{value}', currentPageUnknown: '当前页面：未知', currentPageEmpty: '当前页面：—',
      copyFeedbackEmail: '点击复制反馈邮箱 {email}', feedbackEmail: '反馈邮箱：{email}', updateAt: '更新：{value}',
      ratingTitle: '下载搞定 ⭐ 给个好评呗', ratingText: '用着顺手的话，去 {store} 商店点个分。', rateStore: '去 {store} 商店评分 ⭐', later: '下次再说', never: '别再问了', thanks: '感谢您的支持与赞赏',
      downloadMode: '下载模式', singleVideo: '单视频', listDownload: '列表下载', downloadCover: '下载封面', format: '格式', mp4Video: 'MP4 视频',
      filenamePreviewWait: '文件名预览会在识别视频后显示', saveAs: '保存为：', estimateUnknown: '预计大小 —', startDownload: '开始下载', browserDownloads: '浏览器下载记录', retryRecognize: '重新识别',
      collectionGuide: '要看全部分集：先打开页面右侧「合集」，再点「刷新列表」。', collectionList: '合集列表', refreshList: '刷新列表', selectAll: '全选', selectLoaded: '选择当前已加载的所有视频', deselectAll: '取消全选', loadMore: '继续加载', retryIncomplete: '重试未完成', downloadSelected: '下载已选视频', pause: '暂停', resume: '继续', cancel: '取消', cancelQueue: '取消整队',
      loading: '加载中', loadingMore: '正在加载…', noQuality: '无可用清晰度', noCollectionVideos: '没有可下载的合集视频。', noCollectionLoaded: '尚未加载到合集视频',
      notCollection: '当前作品不属于合集。', refreshingCollection: '正在刷新合集列表…', readingCollection: '正在读取已缓存的合集…', collectionNotRead: '未读到合集。打开右侧「合集」后再点「刷新列表」。', collectionIncomplete: '列表尚未完整，可点「继续加载」。', collectionReady: '勾选合集视频后将依次下载；下载期间请保持页面打开。', noMoreVideos: '没有更多可加载的视频。',
      unrecognizedVideo: '未识别到视频', openSingleVideo: '请打开单个视频页', douyinVideo: '抖音视频', prepareDownload: '准备下载', downloading: '下载中…', downloadingVideo: '下载视频', savingLocal: '保存到本地', paused: '已暂停', savedCover: '封面已保存', savingCover: '正在保存封面…', downloadFailed: '下载失败', coverFailed: '封面下载失败',
      agentNotReady: '页面代理未就绪，请刷新页面后重试', agentTimeout: '页面代理超时，请刷新页面重试', recognizeTimeout: '识别超时：请先播放视频几秒，再点面板刷新；或刷新整页后重试', recognizeFailed: '未识别到视频信息，请先播放当前视频或刷新页面', openSingleVideoDownload: '请打开单个视频页后再下载', unavailableSource: '未能识别该集片源', pagePlay: '页面播放',
      browserNoDownloadId: '浏览器没有返回下载编号', directDownloadFailed: '直链下载失败', noVideoData: '页内取流没有返回视频数据', downloadCancelled: '下载已取消', retryOrSwitch: '。可刷新页面后重试，或切换清晰度。',
      allDownloadsBusy: '最多同时 {count} 个下载，请等完成后再加', waitForDownloads: '请先等待当前下载完成，再开始列表下载。', loadingCollectionMore: '正在加载更多（当前 {count} 集）…', savedFile: '已保存：{name}', estimateSize: '预计大小：约 {size}（约数，仅供参考）', audioOnlyWarning: ' · 部分播放器可能只有声音', play: '播放',
      parallelFull: '并行已满 ({count})', anotherDownload: '再下一个 ({count})', selectedCount: '已加载 {loaded}{total} · 已选 {selected} 个', totalEpisodes: ' / 共 {count} 集', downloadSelectedCount: '下载已选 {count} 个', retryIncompleteCount: '重试未完成（{count}）',
      loadingBackup: '正在尝试备用地址 {index}/{total}', loadingEpisode: '正在下载 {index}/{total}：{title}', collectionCancelled: '列表下载已取消：已保存 {ok} 个，失败 {fail} 个，未执行 {skipped} 个', collectionFinishedWithFailures: '列表下载完成：成功 {ok} 个，失败 {fail} 个', collectionFinished: '列表下载完成：已保存 {ok} 个视频', loadedEpisodes: '已加载 {added} 集，当前共 {total} 集。',
      monthsAgo: '{count} 个月前', yearsAgo: '{count} 年前', minutesAgo: '{count} 分钟前', hoursAgo: '{count} 小时前', daysAgo: '{count} 天前', justNow: '刚刚',
      copied: '已复制', donateIntro: '您的支持将用于持续维护适配、改进下载体验。赞赏完全自愿，下载功能始终免费。', selectDonateMethod: '选择赞赏方式', wechatSupport: '微信赞赏', alipaySupport: '支付宝', qrCode: '{method}二维码',
      switchFailed: '切换失败', refreshCollectionFailed: '刷新合集失败', loadCollectionFailed: '读取合集失败', loadMoreFailed: '继续加载失败', listDownloadFailed: '列表下载失败', cancellingList: '正在取消列表下载…', requestFailed: '请求失败', recognizingVideo: '正在识别当前视频', pleaseWait: '请稍候…', pageMismatch: '识别结果与当前作品不匹配，请刷新页面后重试', noResume: '此地址暂不支持续传，可取消后重试', listQuality: '列表 · {quality}', episode: '第{number}集', video: '视频'
    },
    en: {
      settings: 'Settings',
      settingsHint: 'Theme and filename apply to the download panel',
      language: 'Language',
      english: 'English',
      chinese: '中文',
      theme: 'Theme',
      themeSaved: 'Theme saved',
      themeSaveFailed: 'Couldn’t save the theme',
      'theme-douyin': 'Default',
      'theme-tokyo-love': 'Tokyo Love Story',
      'theme-manchester-sea': 'Manchester by the Sea',
      'theme-chinese-odyssey': 'A Chinese Odyssey',
      filename: 'Filename',
      filenameRule: 'Filename rule',
      presetTitle: 'Default (title only)',
      presetTitleId: 'Title + video ID',
      presetTitleIdQuality: 'Title + video ID + quality',
      presetDetailed: 'Title + author + video ID + quality',
      presetCustom: 'Custom…',
      customTemplate: 'Custom filename template',
      insertField: 'Insert field',
      chipTitle: 'Title',
      chipAuthor: 'Author',
      chipId: 'Video ID',
      chipEpisode: 'Episode',
      chipQuality: 'Quality',
      chipDate: 'Date',
      previewPrefix: 'Preview: ',
      templateInvalid: 'Invalid template',
      templateEmpty: 'Filename template cannot be empty',
      templatePath: 'Template cannot include a path',
      unknownField: 'Unknown field: ',
      saved: 'Saved',
      saveFailed: 'Couldn’t save',
      resetFilename: 'Reset filename',
      filenameReset: 'Filename reset',
      resetFailed: 'Couldn’t reset',
      sampleTitle: 'Sample video title',
      sampleAuthor: 'Sample author',
      extensionTitle: 'Douyin Video Downloader', close: 'Close', backToDownload: 'Back to downloads', debugLog: 'Debug log', copy: 'Copy', clear: 'Clear',
      notice: 'Announcements', feedback: 'Feedback', donate: 'Support', faq: 'FAQ', privacy: 'Privacy',
      loadingPage: 'Reading page…', quality: 'Quality', openDownloadPanel: 'Open download panel', guide: 'Douyin download guide',
      openVideoFirst: 'Open a Douyin video first', openVideoLead: 'Open a single video, or open one from search or recommendations before saving.',
      personalUse: 'For personal learning only. Follow Douyin platform rules.', loadingFailed: 'Loading failed', cannotReadInfo: 'Video information is unavailable',
      refreshHint: 'Refresh the video page with F5, then click the extension icon again.', refreshRetry: 'Refresh and retry', openSite: 'Open Douyin',
      saveInPanel: 'Use the floating button at the lower-right of the page to open the download panel.', refreshAfterInstall: 'After installing or updating, refresh this video page with F5 first.',
      openRefresh: 'Open a single video, or open one from search or recommendations, then press F5.', openFloatingPanel: 'Use the floating button at the lower-right of the page to open the panel.',
      personalScope: 'Only public videos, covers and collections that can play now are supported. Membership, paid and live content are unavailable.',
      collectionTip: 'For a collection, switch to List download to save multiple videos.', collectionStep: 'Choose a quality for a single video; for a collection, open the Collection panel and then choose List download.',
      unableReadPage: 'Unable to read this page. Press F5 first.', unableOpenPanel: 'Unable to open the panel. Refresh the page.', unableRefresh: 'Unable to refresh this page. Press F5 manually.', currentContent: 'Current content', openWebsite: 'Open website',
      currentPage: 'Current page: {value}', currentPageUnknown: 'Current page: unknown', currentPageEmpty: 'Current page: —',
      copyFeedbackEmail: 'Copy feedback email {email}', feedbackEmail: 'Feedback email: {email}', updateAt: 'Updated: {value}',
      ratingTitle: 'Download complete ⭐ Leave a rating?', ratingText: 'If it helped, rate it in the {store} store.', rateStore: 'Rate in {store} ⭐', later: 'Maybe later', never: 'Don’t ask again', thanks: 'Thank you for your support',
      downloadMode: 'Download mode', singleVideo: 'Single video', listDownload: 'List download', downloadCover: 'Download cover', format: 'Format', mp4Video: 'MP4 video',
      filenamePreviewWait: 'Filename preview appears after the video is recognized', saveAs: 'Save as: ', estimateUnknown: 'Estimated size —', startDownload: 'Start download', browserDownloads: 'Browser downloads', retryRecognize: 'Recognize again',
      collectionGuide: 'To see every episode, open Collection on the right side of the page, then choose Refresh list.', collectionList: 'Collection', refreshList: 'Refresh list', selectAll: 'Select all', selectLoaded: 'Select all currently loaded videos', deselectAll: 'Clear selection', loadMore: 'Load more', retryIncomplete: 'Retry incomplete', downloadSelected: 'Download selected videos', pause: 'Pause', resume: 'Resume', cancel: 'Cancel', cancelQueue: 'Cancel queue',
      loading: 'Loading', loadingMore: 'Loading…', noQuality: 'No available quality', noCollectionVideos: 'There are no downloadable videos in this collection.', noCollectionLoaded: 'No collection videos have been loaded',
      notCollection: 'This video is not in a collection.', refreshingCollection: 'Refreshing collection list…', readingCollection: 'Reading cached collection…', collectionNotRead: 'No collection was found. Open Collection on the right side, then choose Refresh list.', collectionIncomplete: 'The list is incomplete. Choose Load more.', collectionReady: 'Select episodes to download them in sequence. Keep this page open while downloading.', noMoreVideos: 'No more videos to load.',
      unrecognizedVideo: 'Video not recognized', openSingleVideo: 'Open a single video page', douyinVideo: 'Douyin video', prepareDownload: 'Preparing download', downloading: 'Downloading…', downloadingVideo: 'Downloading video', savingLocal: 'Saving locally', paused: 'Paused', savedCover: 'Cover saved', savingCover: 'Saving cover…', downloadFailed: 'Download failed', coverFailed: 'Cover download failed',
      agentNotReady: 'The page helper is not ready. Refresh the page and try again.', agentTimeout: 'The page helper timed out. Refresh the page and try again.', recognizeTimeout: 'Recognition timed out: play the video for a few seconds, then refresh the panel or page.', recognizeFailed: 'Video not recognized. Play the current video first, or refresh the page.', openSingleVideoDownload: 'Open a single video page before downloading.', unavailableSource: 'This episode source could not be recognized.', pagePlay: 'Page playback',
      browserNoDownloadId: 'The browser did not return a download ID', directDownloadFailed: 'Direct download failed', noVideoData: 'The page did not return video data', downloadCancelled: 'Download cancelled', retryOrSwitch: '. Refresh the page and try again, or choose another quality.',
      allDownloadsBusy: 'Up to {count} downloads can run at once. Wait for one to finish.', waitForDownloads: 'Wait for the current downloads to finish before starting list download.', loadingCollectionMore: 'Loading more (currently {count} episodes)…', savedFile: 'Saved: {name}', estimateSize: 'Estimated size: about {size} (estimate only)', audioOnlyWarning: ' · Some players may have audio only', play: 'Plays',
      parallelFull: 'All download slots are busy ({count})', anotherDownload: 'Download another ({count})', selectedCount: 'Loaded {loaded}{total} · Selected {selected}', totalEpisodes: ' / {count} episodes', downloadSelectedCount: 'Download selected ({count})', retryIncompleteCount: 'Retry incomplete ({count})',
      loadingBackup: 'Trying backup address {index}/{total}', loadingEpisode: 'Downloading {index}/{total}: {title}', collectionCancelled: 'List download cancelled: saved {ok}, failed {fail}, skipped {skipped}', collectionFinishedWithFailures: 'List download complete: saved {ok}, failed {fail}', collectionFinished: 'List download complete: saved {ok} videos', loadedEpisodes: 'Loaded {added} episodes, {total} total.',
      monthsAgo: '{count} months ago', yearsAgo: '{count} years ago', minutesAgo: '{count} min ago', hoursAgo: '{count} hr ago', daysAgo: '{count} days ago', justNow: 'Just now',
      copied: 'Copied', donateIntro: 'Your support helps maintain compatibility and improve downloads. Support is optional and downloading remains free.', selectDonateMethod: 'Choose a support method', wechatSupport: 'WeChat support', alipaySupport: 'Alipay support', qrCode: '{method} QR code',
      switchFailed: 'Couldn’t switch mode', refreshCollectionFailed: 'Couldn’t refresh the collection', loadCollectionFailed: 'Couldn’t read the collection', loadMoreFailed: 'Couldn’t load more', listDownloadFailed: 'List download failed', cancellingList: 'Cancelling list download…', requestFailed: 'Request failed', recognizingVideo: 'Recognizing current video', pleaseWait: 'Please wait…', pageMismatch: 'The recognized video does not match this page. Refresh and try again.', noResume: 'This address cannot resume. Cancel and try again.', listQuality: 'List · {quality}', episode: 'Episode {number}', video: 'Video'
    }
  };

  let language = 'zh-CN';
  const subscribers = new Set();
  const originals = new WeakMap();

  function api() {
    return root.browser || root.chrome;
  }

  function storageGet(key) {
    const ext = api();
    const get = ext?.storage?.local?.get;
    if (typeof get !== 'function') return Promise.resolve({});
    try {
      const result = get.call(ext.storage.local, key);
      if (result && typeof result.then === 'function') return result;
    } catch (_) {}
    return new Promise((resolve) => {
      try {
        get.call(ext.storage.local, key, (value) => resolve(value || {}));
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(value) {
    const ext = api();
    const set = ext?.storage?.local?.set;
    if (typeof set !== 'function') return Promise.resolve();
    try {
      const result = set.call(ext.storage.local, value);
      if (result && typeof result.then === 'function') return result;
    } catch (_) {}
    return new Promise((resolve) => {
      try {
        set.call(ext.storage.local, value, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  function normalize(value) {
    return value === 'en' ? 'en' : value === 'zh-CN' ? 'zh-CN' : '';
  }

  function t(key, values) {
    const template = messages[language]?.[key] ?? messages['zh-CN']?.[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? ''));
  }

  function keyForChinese(text) {
    return Object.keys(messages['zh-CN']).find((key) => messages['zh-CN'][key] === text) || '';
  }

  // This accepts complete UI strings only. It deliberately never translates a
  // substring, so page titles, authors and user supplied filename templates stay intact.
  function translateText(value) {
    const text = String(value ?? '');
    const key = keyForChinese(text);
    if (key) return t(key);
    const englishKey = Object.keys(messages.en).find((name) => messages.en[name] === text);
    if (englishKey) return t(englishKey);
    const estimateWithCompatibility = text.match(/^预计大小：约 (.*)（约数，仅供参考） · 部分播放器可能只有声音$/);
    if (estimateWithCompatibility) return t('estimateSize', { size: estimateWithCompatibility[1] }) + t('audioOnlyWarning');
    const patterns = [
      [/^当前页面：(.*)$/, 'currentPage', 'value'],
      [/^反馈邮箱：(.*)$/, 'feedbackEmail', 'email'],
      [/^点击复制反馈邮箱 (.*)$/, 'copyFeedbackEmail', 'email'],
      [/^更新：(.*)$/, 'updateAt', 'value'],
      [/^用着顺手的话，去 (.*) 商店点个分。$/, 'ratingText', 'store'],
      [/^去 (.*) 商店评分 ⭐$/, 'rateStore', 'store']
      ,[/^并行已满 \((\d+)\)$/, 'parallelFull', 'count']
      ,[/^再下一个 \((\d+)\)$/, 'anotherDownload', 'count']
      ,[/^已加载 (\d+)( \/ 共 \d+ 集)? · 已选 (\d+) 个$/, 'selectedCount', ['loaded', 'total', 'selected']]
      ,[/^下载已选 (\d+) 个$/, 'downloadSelectedCount', 'count']
      ,[/^重试未完成（(\d+)）$/, 'retryIncompleteCount', 'count']
      ,[/^正在尝试备用地址 (\d+)\/(\d+)$/, 'loadingBackup', ['index', 'total']]
      ,[/^正在加载更多（当前 (\d+) 集）…$/, 'loadingCollectionMore', 'count']
      ,[/^已加载 (\d+) 集，当前共 (\d+) 集。$/, 'loadedEpisodes', ['added', 'total']]
      ,[/^正在下载 (\d+)\/(\d+)：(.*)$/, 'loadingEpisode', ['index', 'total', 'title']]
      ,[/^已保存：(.*)$/, 'savedFile', 'name']
      ,[/^预计大小：约 (.*)（约数，仅供参考）$/, 'estimateSize', 'size']
      ,[/^最多同时 (\d+) 个下载，请等完成后再加$/, 'allDownloadsBusy', 'count']
      ,[/^列表下载已取消：已保存 (\d+) 个，失败 (\d+) 个，未执行 (\d+) 个$/, 'collectionCancelled', ['ok', 'fail', 'skipped']]
      ,[/^列表下载完成：成功 (\d+) 个，失败 (\d+) 个$/, 'collectionFinishedWithFailures', ['ok', 'fail']]
      ,[/^列表下载完成：已保存 (\d+) 个视频$/, 'collectionFinished', 'ok']
      ,[/^第(\d+)集$/, 'episode', 'number'], [/^列表 · (.*)$/, 'listQuality', 'quality']
      ,[/^(\d+) 分钟前$/, 'minutesAgo', 'count'], [/^(\d+) 小时前$/, 'hoursAgo', 'count'], [/^(\d+) 天前$/, 'daysAgo', 'count'], [/^(\d+) 个月前$/, 'monthsAgo', 'count'], [/^(\d+) 年前$/, 'yearsAgo', 'count']
    ];
    for (const [matcher, patternKey, name] of patterns) {
      const match = text.match(matcher);
      if (match) {
        const values = Array.isArray(name) ? Object.fromEntries(name.map((item, index) => [item, match[index + 1] || ''])) : { [name]: match[1] };
        if (patternKey === 'selectedCount') values.total = values.total ? t('totalEpisodes', { count: values.total.match(/\d+/)?.[0] || '' }) : '';
        return t(patternKey, values);
      }
    }
    const englishPatterns = [
      [/^Current page: (.*)$/, 'currentPage', 'value'], [/^Feedback email: (.*)$/, 'feedbackEmail', 'email'],
      [/^Copy feedback email (.*)$/, 'copyFeedbackEmail', 'email'], [/^Updated: (.*)$/, 'updateAt', 'value'],
      [/^If it helped, rate it in the (.*) store\.$/, 'ratingText', 'store'], [/^Rate in (.*) ⭐$/, 'rateStore', 'store']
    ];
    for (const [matcher, patternKey, name] of englishPatterns) {
      const match = text.match(matcher);
      if (match) return t(patternKey, { [name]: match[1] });
    }
    return text;
  }

  function setText(element, value) {
    if (!element) return element;
    const source = String(value ?? '');
    if (isProtected(element)) {
      element.textContent = source;
      return element;
    }
    originals.set(element, source);
    element.dataset.i18nSource = '1';
    element.textContent = translateText(source);
    return element;
  }

  function isProtected(element) {
    if (element.dataset?.i18nUiMessage === '1') return false;
    return element.closest?.('.dy-dl-video-title, .dy-dl-video-author, .dy-dl-filename-preview-name, .dy-dl-list-item-title, .dy-dl-progress-title, [data-user-content]');
  }

  // Only explicit extension nodes are visited. There is no document-wide text walk
  // and no observer, avoiding page-content mutation and background work.
  function translateDom(scope) {
    if (!scope?.querySelectorAll) return;
    const local = [scope, ...scope.querySelectorAll('[data-i18n], [data-i18n-source], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder]')];
    local.forEach((element) => {
      if (isProtected(element)) return;
      if (element.dataset?.i18n) element.textContent = t(element.dataset.i18n);
      else if (originals.has(element)) element.textContent = translateText(originals.get(element));
      if (element.dataset?.i18nTitle) element.title = t(element.dataset.i18nTitle);
      if (element.dataset?.i18nAriaLabel) element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
      if (element.dataset?.i18nPlaceholder) element.placeholder = t(element.dataset.i18nPlaceholder);
    });
  }

  function emit() {
    subscribers.forEach((listener) => { try { listener(language); } catch (_) {} });
    try { root.dispatchEvent(new CustomEvent('downloader-kit-language-change', { detail: { language } })); } catch (_) {}
  }

  const ready = storageGet(KEY).then((stored) => {
    language = normalize(stored?.[KEY]) || 'zh-CN';
    return language;
  }).catch(() => language);

  async function save(value) {
    language = normalize(value) || 'zh-CN';
    await storageSet({ [KEY]: language });
    emit();
    return language;
  }

  api()?.storage?.onChanged?.addListener?.((changes, areaName) => {
    if (areaName !== 'local' || !changes?.[KEY]) return;
    const next = normalize(changes[KEY].newValue) || 'zh-CN';
    if (next === language) return;
    language = next;
    emit();
  });

  kit.i18n = {
    KEY,
    ready,
    language: () => language,
    t,
    save,
    translateText,
    translateDom,
    setText,
    onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
