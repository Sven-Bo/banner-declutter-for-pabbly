/**
 * Thin, immutable wrapper over chrome.storage.sync.
 * Every read returns a fresh frozen object; every write is a merge, not a mutation.
 */
(() => {
  'use strict';

  const NS = (globalThis.__pabblyDeclutter ||= {});
  if (NS.storage) return;

  const { STORAGE_KEY, DEFAULT_SETTINGS } = NS.config;

  const normalise = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    return Object.freeze({
      ...DEFAULT_SETTINGS,
      ...source,
      customSelectors: Object.freeze({ ...(source.customSelectors || {}) })
    });
  };

  const load = async () => {
    try {
      const bag = await chrome.storage.sync.get(STORAGE_KEY);
      return normalise(bag?.[STORAGE_KEY]);
    } catch (err) {
      console.warn('[Banner Declutter] could not read settings, using defaults:', err);
      return normalise(null);
    }
  };

  /** Merge `patch` into the stored settings and return the new frozen settings. */
  const save = async (patch) => {
    const current = await load();
    const next = normalise({ ...current, ...patch });
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: next });
    } catch (err) {
      console.warn('[Banner Declutter] could not save settings:', err);
    }
    return next;
  };

  /** Add one user-picked selector for a hostname, without touching other hosts. */
  const addCustomSelector = async (hostname, selector) => {
    if (!hostname || !selector) return load();
    const current = await load();
    const existing = current.customSelectors[hostname] || [];
    if (existing.includes(selector)) return current;
    return save({
      customSelectors: {
        ...current.customSelectors,
        [hostname]: [...existing, selector]
      }
    });
  };

  const clearCustomSelectors = async (hostname) => {
    const current = await load();
    if (!hostname || !current.customSelectors[hostname]) return current;
    const next = { ...current.customSelectors };
    delete next[hostname];
    return save({ customSelectors: next });
  };

  /** Fires whenever settings change in any context (popup, other tab, sync). */
  const onChange = (handler) => {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' || !changes[STORAGE_KEY]) return;
        handler(normalise(changes[STORAGE_KEY].newValue));
      });
    } catch (err) {
      console.warn('[Banner Declutter] could not subscribe to settings:', err);
    }
  };

  NS.storage = Object.freeze({ load, save, addCustomSelector, clearCustomSelectors, onChange });
})();
