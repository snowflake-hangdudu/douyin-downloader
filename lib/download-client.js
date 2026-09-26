/* Browser-managed downloads. Shared by the content UI and deterministic tests. */
(function (root, factory) {
  const api = factory();
  root.DouyinDownloadClient = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STOP_ERRORS = /USER_CANCELED|USER_SHUTDOWN|FILE_BLOCKED|FILE_SECURITY_CHECK_FAILED|FILE_VIRUS_INFECTED|FILE_ACCESS_DENIED|FILE_NO_SPACE|FILE_NAME_TOO_LONG/;
  function create({ send, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now }) {
    async function request(type, data = {}) {
      const result = await send({ type: 'DOUYIN_DL_' + type, ...data });
      if (!result?.ok) throw new Error(result?.error || '浏览器下载服务没有响应，请刷新页面');
      return result;
    }
    async function control(job, action) {
      if (action === 'CANCEL') job.cancelRequested = true;
      if (!Number.isInteger(job.downloadId)) return;
      const state = await request(action + '_MEDIA', { downloadId: job.downloadId });
      if (action === 'CANCEL' && state.state === 'complete') job.cancelRequested = false;
      return state;
    }
    async function monitor(job, onProgress = () => {}) {
      let bytes = -1, changedAt = now();
      for (;;) {
        if (job.cancelRequested) {
          const result = await control(job, 'CANCEL');
          if (result?.state !== 'complete') throw new Error('下载已取消');
        }
        const state = await request('MEDIA_STATE', { downloadId: job.downloadId });
        if (state.state === 'complete') {
          if (state.exists === false) throw new Error('下载文件已被移除');
          if (/text\/html|application\/json/i.test(state.mime || '')) throw new Error('服务器返回了错误页面，请刷新页面后重试');
          onProgress(state);
          return state;
        }
        if (state.state === 'interrupted') {
          const error = new Error(state.error || '浏览器下载中断');
          error.retryable = true;
          throw error;
        }
        job.paused = Boolean(state.paused);
        onProgress(state);
        if (state.paused || bytes !== state.bytesReceived) {
          bytes = state.bytesReceived;
          changedAt = now();
        } else if (now() - changedAt > 180000) {
          await request('CANCEL_MEDIA', { downloadId: job.downloadId });
          const error = new Error('下载三分钟无进展，已停止当前地址');
          error.retryable = true;
          throw error;
        }
        await sleep(750);
      }
    }
    async function download(job, onProgress, onRetry = () => {}) {
      const urls = [...new Set(job.urls || [])].slice(0, 8);
      let lastError;
      for (let index = 0; index < urls.length; index += 1) {
        if (job.cancelRequested) throw new Error('下载已取消');
        job.downloadId = null;
        try {
          const started = await request('SAVE_DIRECT', { urls: [urls[index]], filename: job.filename, saveAs: Boolean(job.saveAs) });
          job.downloadId = started.downloadId;
          return await monitor(job, onProgress);
        } catch (error) {
          if (job.cancelRequested) throw new Error('下载已取消');
          // If querying failed, the old download may still be running. Never duplicate it.
          if (Number.isInteger(job.downloadId) && error.retryable !== true) throw error;
          if (STOP_ERRORS.test(error.message) || /下载文件已被移除|错误页面|无法确认|记录不可用/.test(error.message)) throw error;
          // With a save dialog, do not open another dialog automatically after failure.
          if (job.saveAs) throw error;
          lastError = error;
          if (index + 1 < urls.length) onRetry(index + 2, urls.length, error);
        }
      }
      throw lastError || new Error('当前清晰度没有可下载地址');
    }
    return { request, control, monitor, download };
  }
  return { create };
});
