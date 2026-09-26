(function initDebugFlag(root) {
  root.DownloaderKit = root.DownloaderKit || {};
  root.DownloaderKit.DEBUG = false; // @pack:debug
})(typeof globalThis !== 'undefined' ? globalThis : this);
