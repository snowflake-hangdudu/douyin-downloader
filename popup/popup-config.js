window.DOWNLOADER_POPUP_CONFIG = {
  title: '抖音下载助手',
  getInfoType: 'DOUYIN_DL_GET_INFO',
  openPanelType: 'DOUYIN_DL_OPEN_PANEL',
  faqUrl: 'https://snowflake-hangdudu.github.io/douyin-downloader/faq.html',
  privacyUrl: 'https://snowflake-hangdudu.github.io/douyin-downloader/',
  isSiteUrl(url) {
    return /(^|\.)douyin\.com$|(^|\.)iesdouyin\.com$/i.test((() => {
      try { return new URL(url).hostname; } catch (_) { return ''; }
    })());
  },
  isContentUrl(url) {
    return /\/(?:video|note|share\/video)\/\d{5,}/i.test(String(url || ''))
      || /[?&]modal_id=\d{5,}/i.test(String(url || ''));
  },
  readyTips: [
    '实际保存请点页面右下角图标打开的面板',
    '当前只支持单个视频，不支持用户页批量下载',
    '安装或更新后请先 F5 刷新当前视频页'
  ],
  empty: {
    detect: '未识别到单个视频页',
    title: '请先打开抖音视频',
    lead: '打开 www.douyin.com 的单个视频页，或在推荐流里点开一条视频后再保存。',
    steps: [
      '打开抖音网页版的单个视频页，按 F5 刷新',
      '点击页面右下角图标打开面板',
      '选择清晰度后保存 MP4'
    ],
    tags: ['单个视频', '清晰度', '封面'],
    homeUrl: 'https://www.douyin.com/',
    homeLabel: '打开抖音'
  },
  error: {
    title: '暂时无法读取视频信息',
    hint: '请在视频页按 F5 刷新后，再点击扩展图标。'
  }
};
