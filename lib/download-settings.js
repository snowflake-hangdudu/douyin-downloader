/* Versioned, platform-scoped settings for Douyin downloader. */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'douyinDlSettings_v1';
  const DEFAULTS = Object.freeze({ version: 1, filenameTemplate: '{title}' });
  const Filename = root.DouyinDlFilename;

  function cloneDefaults() {
    return { version: DEFAULTS.version, filenameTemplate: DEFAULTS.filenameTemplate };
  }

  function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const template = String(source.filenameTemplate || DEFAULTS.filenameTemplate).trim();
    const check = Filename.validateTemplate(template);
    return { version: DEFAULTS.version, filenameTemplate: check.ok ? check.template : DEFAULTS.filenameTemplate };
  }

  function create(storage) {
    const io = storage || {};
    async function loadSettings() {
      const stored = await io.get([STORAGE_KEY]);
      const value = stored?.[STORAGE_KEY];
      if (value && typeof value === 'object') return normalizeSettings(value);
      const defaults = cloneDefaults();
      await io.set({ [STORAGE_KEY]: defaults });
      return defaults;
    }
    async function saveSettings(partial) {
      const current = await loadSettings();
      const incoming = partial || {};
      if (Object.prototype.hasOwnProperty.call(incoming, 'filenameTemplate')) {
        const check = Filename.validateTemplate(incoming.filenameTemplate);
        if (!check.ok) throw new Error(check.error);
      }
      const merged = normalizeSettings({ ...current, ...incoming });
      await io.set({ [STORAGE_KEY]: merged });
      return merged;
    }
    async function resetSettings() {
      const defaults = cloneDefaults();
      await io.set({ [STORAGE_KEY]: defaults });
      return defaults;
    }
    return { loadSettings, saveSettings, resetSettings };
  }

  root.DouyinDlSettings = { STORAGE_KEY, DEFAULTS, cloneDefaults, normalizeSettings, create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DouyinDlSettings;
})(typeof globalThis !== 'undefined' ? globalThis : this);
