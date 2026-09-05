/**
 * Click-to-hide picker: when Pabbly ships a new nag this doesn't recognise,
 * the user points at it once and it stays gone (stored per hostname).
 */
(() => {
  'use strict';

  const NS = (globalThis.__pabblyDeclutter ||= {});
  if (NS.picker) return;

  const { hider, storage } = NS;

  const MAX_PATH_DEPTH = 8;
  const MAX_CLASSES_PER_STEP = 2;

  const state = { active: false, box: null, hint: null, target: null, onDone: null };

  /** Reject hashed/atomic class names — they change on every deploy. */
  const isStableToken = (token) =>
    Boolean(token) &&
    token.length > 1 &&
    token.length < 40 &&
    !/^\d/.test(token) &&
    !/\d{3,}/.test(token) &&
    !/^[a-z-]*[0-9a-f]{6,}$/i.test(token) &&
    !token.startsWith('pbb-');

  const stableClasses = (el) =>
    Array.from(el.classList).filter(isStableToken).slice(0, MAX_CLASSES_PER_STEP);

  const escape = (value) =>
    (window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^\w-]/g, '\\$&'));

  const stepFor = (el) => {
    const tag = el.tagName.toLowerCase();
    const classes = stableClasses(el).map((cls) => `.${escape(cls)}`).join('');
    const base = `${tag}${classes}`;
    const parent = el.parentElement;
    if (!parent) return base;
    const twins = Array.from(parent.children).filter((sibling) => {
      try {
        return sibling.matches(base);
      } catch {
        return false;
      }
    });
    if (twins.length <= 1) return base;
    const index = Array.from(parent.children).filter((s) => s.tagName === el.tagName).indexOf(el) + 1;
    return `${base}:nth-of-type(${index})`;
  };

  /**
   * Build the shortest selector that resolves to exactly this element.
   * Returns null if no unique path is found — a selector that matched several
   * elements would quietly hide unrelated parts of the page on the next load.
   */
  const selectorFor = (el) => {
    if (!(el instanceof Element)) return null;

    if (el.id && isStableToken(el.id)) {
      const byId = `#${escape(el.id)}`;
      try {
        if (document.querySelectorAll(byId).length === 1) return byId;
      } catch { /* fall through to the path build */ }
    }

    const steps = [];
    let node = el;
    while (node && node !== document.body && steps.length < MAX_PATH_DEPTH) {
      steps.unshift(stepFor(node));
      const candidate = steps.join(' > ');
      try {
        const matches = document.querySelectorAll(candidate);
        if (matches.length === 1 && matches[0] === el) return candidate;
      } catch { /* keep widening */ }
      node = node.parentElement;
    }
    return null;
  };

  const isOwnUi = (el) => Boolean(el && el.closest && el.closest('[data-pbb-keep]'));

  const highlight = (el) => {
    if (!state.box || !el) return;
    const box = el.getBoundingClientRect();
    Object.assign(state.box.style, {
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      display: 'block'
    });
  };

  const onMove = (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || isOwnUi(el) || el === document.documentElement || el === document.body) return;
    state.target = el;
    highlight(el);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stop({ picked: false });
    }
  };

  const onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const el = state.target;
    if (!el || isOwnUi(el)) {
      stop({ picked: false });
      return;
    }
    const selector = selectorFor(el);
    stop({ picked: true, selector, persisted: Boolean(selector) });

    // Always honour the click. Persist it only when we can address the element
    // unambiguously — otherwise it is hidden for this page view alone.
    hider.hide(el, 'custom');
    if (selector) await storage.addCustomSelector(location.hostname, selector);
  };

  const buildUi = () => {
    const box = document.createElement('div');
    box.className = 'pbb-picker-box';
    box.setAttribute('data-pbb-keep', '');

    const hint = document.createElement('div');
    hint.className = 'pbb-picker-hint';
    hint.setAttribute('data-pbb-keep', '');
    hint.textContent = 'Click the thing you want gone  ·  Esc to cancel';

    document.body.append(box, hint);
    return { box, hint };
  };

  const start = (onDone) => {
    if (state.active || !document.body) return false;
    const { box, hint } = buildUi();
    Object.assign(state, { active: true, box, hint, target: null, onDone });
    document.documentElement.classList.add('pbb-picking');
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    return true;
  };

  const stop = (result) => {
    if (!state.active) return;
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    document.documentElement.classList.remove('pbb-picking');
    state.box?.remove();
    state.hint?.remove();
    const done = state.onDone;
    Object.assign(state, { active: false, box: null, hint: null, target: null, onDone: null });
    if (typeof done === 'function') done(result);
  };

  NS.picker = Object.freeze({ start, stop, selectorFor, isActive: () => state.active });
})();
