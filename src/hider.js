/**
 * The only place in the extension that touches the DOM's visibility.
 * Hiding is a marker attribute plus a stylesheet rule, so it is fully reversible
 * and never destroys the page's own inline styles.
 */
(() => {
  'use strict';

  const NS = (globalThis.__pabblyDeclutter ||= {});
  if (NS.hider) return;

  const { BACKDROP_SELECTOR, SCROLL_LOCK_CLASS_PATTERN } = NS.config;

  const ATTR = 'data-pbb-hidden';
  const REASON_ATTR = 'data-pbb-reason';

  /** Elements we hid this page-load, so we can count and undo them. */
  const hiddenNodes = new Set();

  const isHidden = (el) => el instanceof Element && el.hasAttribute(ATTR);

  const hide = (el, reason) => {
    if (!(el instanceof Element) || isHidden(el)) return false;
    try {
      el.setAttribute(ATTR, '');
      el.setAttribute(REASON_ATTR, reason || 'promo');
      hiddenNodes.add(el);
      return true;
    } catch (err) {
      console.warn('[Banner Declutter] could not hide element:', err);
      return false;
    }
  };

  const unhide = (el) => {
    if (!isHidden(el)) return false;
    el.removeAttribute(ATTR);
    el.removeAttribute(REASON_ATTR);
    hiddenNodes.delete(el);
    return true;
  };

  const unhideAll = () => {
    const nodes = document.querySelectorAll(`[${ATTR}]`);
    nodes.forEach(unhide);
    hiddenNodes.clear();
    return nodes.length;
  };

  /** Undo only the blocks hidden for a given reason (used when a toggle flips off). */
  const unhideByReason = (reason) => {
    let restored = 0;
    for (const el of document.querySelectorAll(`[${ATTR}]`)) {
      if (el.getAttribute(REASON_ATTR) === reason && unhide(el)) restored += 1;
    }
    return restored;
  };

  const count = () => document.querySelectorAll(`[${ATTR}]`).length;

  /** True when an element is painted as a full-viewport fixed layer. */
  const isFullScreenLayer = (el) => {
    try {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'absolute') return false;
      const box = el.getBoundingClientRect();
      return box.width >= window.innerWidth * 0.9 && box.height >= window.innerHeight * 0.9;
    } catch {
      return false;
    }
  };

  /**
   * An upsell modal usually leaves behind a dimmed backdrop and a locked body.
   * Clean both up so the page stays usable after we remove the modal itself.
   */
  const restorePageScroll = () => {
    for (const node of [document.documentElement, document.body]) {
      if (!node) continue;
      try {
        if (SCROLL_LOCK_CLASS_PATTERN.test(node.className || '')) {
          node.className = String(node.className)
            .split(/\s+/)
            .filter((cls) => !SCROLL_LOCK_CLASS_PATTERN.test(cls))
            .join(' ');
        }
        if (node.style.overflow === 'hidden') node.style.overflow = '';
        if (node.style.position === 'fixed') node.style.position = '';
        if (node.style.paddingRight) node.style.paddingRight = '';
      } catch (err) {
        console.warn('[Banner Declutter] could not restore scrolling:', err);
      }
    }
  };

  /** Hide dimming layers that are now covering nothing. */
  const hideOrphanBackdrops = () => {
    let removed = 0;
    let candidates;
    try {
      candidates = document.querySelectorAll(BACKDROP_SELECTOR);
    } catch {
      return 0;
    }
    for (const el of candidates) {
      if (isHidden(el)) continue;
      if (!isFullScreenLayer(el)) continue;
      // Only orphaned if everything it wraps is already hidden.
      const visibleChild = Array.from(el.children).some((child) => !isHidden(child));
      if (visibleChild) continue;
      if (hide(el, 'backdrop')) removed += 1;
    }
    return removed;
  };

  NS.hider = Object.freeze({
    ATTR,
    REASON_ATTR,
    hide,
    unhide,
    unhideAll,
    unhideByReason,
    isHidden,
    count,
    isFullScreenLayer,
    restorePageScroll,
    hideOrphanBackdrops
  });
})();
