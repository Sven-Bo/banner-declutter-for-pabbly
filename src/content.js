/**
 * Orchestration: boot early, watch for injected banners, answer the popup.
 *
 * The observer scans synchronously for the first few seconds so a banner is
 * hidden in the same frame it is added, which is what stops the flash.
 */
(() => {
  'use strict';

  const NS = globalThis.__pabblyDeclutter;
  if (!NS || NS.booted) return;
  NS.booted = true;

  const { config, storage, hider, scanner, picker } = NS;
  const { LIMITS } = config;

  const startedAt = Date.now();
  let settings = config.DEFAULT_SETTINGS;
  /** Set by "Show everything" in the popup; suspends hiding until reload. */
  let revealed = false;
  let pendingScan = null;

  const shouldScan = () => settings.enabled && !revealed && !picker.isActive();

  const scanNow = () => {
    if (!shouldScan()) return 0;
    try {
      const hidden = scanner.run(settings);
      // Some layouts measure themselves on load; nudge them after a banner goes.
      if (hidden > 0) window.dispatchEvent(new Event('resize'));
      return hidden;
    } catch (err) {
      console.warn('[Banner Declutter] scan failed:', err);
      return 0;
    }
  };

  const scheduleScan = () => {
    if (pendingScan !== null) return;
    pendingScan = setTimeout(() => {
      pendingScan = null;
      scanNow();
    }, LIMITS.scanDebounceMs);
  };

  const observer = new MutationObserver(() => {
    if (!shouldScan()) return;
    // Early on, hide inside the microtask so nothing ever paints.
    if (Date.now() - startedAt < LIMITS.eagerWindowMs) scanNow();
    else scheduleScan();
  });

  const observe = () => {
    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
    } catch (err) {
      console.warn('[Banner Declutter] could not observe the page:', err);
    }
  };

  /** Pabbly Connect is a single-page app, so re-sweep whenever the route changes. */
  const watchRouteChanges = () => {
    const reScan = () => setTimeout(scanNow, LIMITS.scanDebounceMs);
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      if (typeof original !== 'function') continue;
      history[method] = function patched(...args) {
        const out = original.apply(this, args);
        reScan();
        return out;
      };
    }
    window.addEventListener('popstate', reScan);
    window.addEventListener('hashchange', reScan);
  };

  const applySettings = (next) => {
    const previous = settings;
    settings = next;

    if (!settings.enabled) {
      hider.unhideAll();
      return;
    }
    if (!settings.hidePromoBars && previous.hidePromoBars) hider.unhideByReason('promo');
    if (!settings.hideUpsellModals && previous.hideUpsellModals) hider.unhideByReason('modal');
    if (!settings.hideUpgradeButtons && previous.hideUpgradeButtons) hider.unhideByReason('upgrade-button');
    scanNow();
  };

  const handleMessage = (message, sendResponse) => {
    switch (message?.type) {
      case 'PBB_STATUS':
        sendResponse({
          ok: true,
          host: location.hostname,
          hidden: hider.count(),
          revealed,
          picking: picker.isActive()
        });
        return false;

      case 'PBB_RESCAN':
        revealed = false;
        sendResponse({ ok: true, hidden: scanNow() });
        return false;

      case 'PBB_REVEAL_ALL':
        revealed = true;
        sendResponse({ ok: true, restored: hider.unhideAll() });
        return false;

      case 'PBB_PICK':
        sendResponse({ ok: picker.start(() => scheduleScan()) });
        return false;

      case 'PBB_CLEAR_CUSTOM':
        storage.clearCustomSelectors(location.hostname).then(() => {
          hider.unhideByReason('custom');
          sendResponse({ ok: true });
        });
        return true; // async response

      default:
        return false;
    }
  };

  const boot = async () => {
    observe();
    scanNow();
    watchRouteChanges();

    document.addEventListener('DOMContentLoaded', scanNow, { once: true });
    window.addEventListener('load', () => setTimeout(scanNow, 250), { once: true });

    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
        handleMessage(message, sendResponse)
      );
    } catch (err) {
      console.warn('[Banner Declutter] messaging unavailable:', err);
    }

    storage.onChange(applySettings);
    applySettings(await storage.load());
  };

  boot();
})();
