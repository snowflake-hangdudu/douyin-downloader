/* Douyin download filename template helpers. */
(function (root) {
  'use strict';

  const VARIABLES = [
    { key: 'title', label: '标题' },
    { key: 'author', label: '作者' },
    { key: 'id', label: '视频 ID' },
    { key: 'episode', label: '合集集数' },
    { key: 'quality', label: '清晰度' },
    { key: 'date', label: '日期' }
  ];
  const PRESETS = {
    title: '{title}',
    'title-id': '{title} - {id}',
    'title-id-quality': '{title} - {id} - {quality}',
    detailed: '{title} - {author} - {id} - {quality}'
  };
  const MAX_BASENAME = 120;
  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  function sanitizeSegment(value, fallback) {
    let text = String(value == null ? '' : value).normalize('NFKC')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
    if (!text) text = fallback || '';
    if (RESERVED.test(text)) text = '_' + text;
    return text;
  }

  function validateTemplate(template) {
    const value = String(template || '').trim();
    if (!value) return { ok: false, error: '文件名模板不能为空' };
    if (/[\\/]|\.\./.test(value)) return { ok: false, error: '模板不能包含路径分隔符' };
    const known = new Set(VARIABLES.map((item) => item.key));
    const unknown = [];
    value.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
      if (!known.has(key) && !unknown.includes(key)) unknown.push(key);
      return '';
    });
    if (unknown.length) return { ok: false, error: '未知变量：' + unknown.map((key) => '{' + key + '}').join('、') };
    return { ok: true, template: value };
  }

  function padEpisode(value) {
    const number = Number(value) || 0;
    return number > 0 ? String(number).padStart(2, '0') : '';
  }

  function todayLocal(date) {
    const value = date instanceof Date ? date : new Date();
    return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
  }

  function renderTemplate(template, info, options) {
    const check = validateTemplate(template);
    if (!check.ok) throw new Error(check.error);
    const opts = options || {};
    const values = {
      title: sanitizeSegment(info?.title, '抖音视频') || '抖音视频',
      author: sanitizeSegment(info?.author, ''),
      id: sanitizeSegment(info?.id, ''),
      episode: padEpisode(opts.episode || info?.episode),
      quality: sanitizeSegment(opts.qualityLabel || '', ''),
      date: opts.date || todayLocal(opts.createdAt ? new Date(opts.createdAt) : undefined)
    };
    let rendered = check.template.replace(/\{([a-zA-Z]+)\}/g, (_, key) => values[key] || '');
    rendered = rendered.replace(/\s+[-–—]\s+/g, ' - ').replace(/(?:\s+-\s*){2,}/g, ' - ')
      .replace(/^(?:\s*-\s*)+|(?:\s*-\s*)+$/g, '').replace(/\s{2,}/g, ' ').trim();
    rendered = sanitizeSegment(rendered, '抖音视频') || '抖音视频';
    return Array.from(rendered).slice(0, MAX_BASENAME).join('').replace(/[. ]+$/g, '') || '抖音视频';
  }

  function withExtension(base, extension) {
    const ext = String(extension || 'mp4').replace(/^\./, '').toLowerCase();
    const safe = sanitizeSegment(base, '抖音视频') || '抖音视频';
    return Array.from(safe).slice(0, MAX_BASENAME).join('').replace(/[. ]+$/g, '') + '.' + ext;
  }

  root.DouyinDlFilename = { VARIABLES, PRESETS, MAX_BASENAME, sanitizeSegment, validateTemplate, renderTemplate, withExtension, todayLocal };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DouyinDlFilename;
})(typeof globalThis !== 'undefined' ? globalThis : this);
