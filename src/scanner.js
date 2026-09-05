/**
 * Promo detection.
 *
 * Naive "does this block mention a discount" matching fails badly: a column
 * holding four unrelated cards ("save 25 records", "billed monthly", "Learn
 * more") accumulates enough stray signal to look like an ad, and the whole page
 * disappears. So detection runs in two phases:
 *
 *   1. SEED - find the smallest blocks that are *densely* promotional. A seed
 *             needs strong wording (or two weak signals plus a call to action)
 *             AND that wording has to cover a real share of its own text.
 *   2. GROW - climb out of the seed while every neighbour picked up along the
 *             way is itself promo or negligible, so the whole banner goes as one
 *             unit instead of leaving a coloured strip behind.
 *
 * Anything structural, anything holding a real form control, and anything on a
 * genuine pricing/billing screen is stepped over rather than hidden.
 */
(() => {
  'use strict';

  const NS = (globalThis.__pabblyDeclutter ||= {});
  if (NS.scanner) return;

  const { config, hider } = NS;
  const {
    STRONG_PATTERNS, WEAK_PATTERNS, CTA_PATTERNS,
    UPGRADE_BUTTON_LABELS, UPGRADE_BUTTON_SELECTOR, BILLING_CONTEXT_SELECTOR,
    NEVER_HIDE_SELECTOR, FORM_CONTROL_SELECTOR, MODAL_SELECTOR, LIMITS
  } = config;

  const HIDDEN_SELECTOR = `[${hider.ATTR}]`;

  const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  /** Text a human would read in this block, including image alt text. */
  const readableText = (el) => {
    const own = normalise(el.textContent);
    if (own.length >= 240) return own; // long enough already; skip the label sweep

    const labels = [el.getAttribute('aria-label'), el.getAttribute('title')];
    let labelled = [];
    try {
      labelled = el.querySelectorAll('img[alt], [aria-label], [title]');
    } catch { /* detached node */ }
    for (let i = 0; i < labelled.length && i < LIMITS.maxLabelSamples; i += 1) {
      const node = labelled[i];
      labels.push(node.getAttribute('alt'), node.getAttribute('aria-label'), node.getAttribute('title'));
    }
    return normalise([own, ...labels.filter(Boolean)].join(' '));
  };

  const firstMatchRange = (pattern, text) => {
    const found = text.match(pattern);
    return found && found.index >= 0 ? [found.index, found.index + found[0].length] : null;
  };

  const countMatches = (patterns, text) => patterns.filter((re) => re.test(text)).length;

  /**
   * Share of the text actually covered by promo wording, 0-1.
   * This is what separates a banner (nearly all signal) from a content column
   * that merely happens to contain the same words spread thin.
   */
  const promoDensity = (text) => {
    if (!text) return 0;

    const ranges = [];
    for (const group of [STRONG_PATTERNS, WEAK_PATTERNS, CTA_PATTERNS]) {
      for (const pattern of group) {
        const range = firstMatchRange(pattern, text);
        if (range) ranges.push(range);
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);

    let covered = 0;
    let cursor = 0;
    for (const [start, end] of ranges) {
      const from = Math.max(start, cursor);
      if (end > from) {
        covered += end - from;
        cursor = end;
      }
    }
    return covered / text.length;
  };

  /** 0-5. Used for the loose "is this neighbour promo too" test while growing. */
  const scoreText = (text) => {
    if (!text) return 0;
    let score = 0;
    if (STRONG_PATTERNS.some((re) => re.test(text))) score += 2;
    score += Math.min(2, countMatches(WEAK_PATTERNS, text));
    if (CTA_PATTERNS.some((re) => re.test(text))) score += 1;
    return score;
  };

  const hasStrongWording = (text) => Boolean(text) && STRONG_PATTERNS.some((re) => re.test(text));

  const hasPromoWording = (text) => {
    if (hasStrongWording(text)) return true;
    // No strong phrase: demand a much clearer pattern before believing it.
    return countMatches(WEAK_PATTERNS, text) >= 2 && CTA_PATTERNS.some((re) => re.test(text));
  };

  const safeMatches = (el, selector) => {
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  };

  const safeClosest = (el, selector) => {
    try {
      return Boolean(el.closest(selector));
    } catch {
      return false;
    }
  };

  /** Off-limits: page scaffolding, real controls, and genuine billing screens. */
  const isProtected = (el) =>
    safeMatches(el, NEVER_HIDE_SELECTOR) ||
    safeClosest(el, BILLING_CONTEXT_SELECTOR) ||
    Boolean(el.querySelector(FORM_CONTROL_SELECTOR));

  const isSeed = (el, text) =>
    text.length > 0 &&
    text.length <= LIMITS.maxBannerTextLength &&
    hasPromoWording(text) &&
    (text.length <= LIMITS.shortTextBypass || promoDensity(text) >= LIMITS.minSeedDensity) &&
    !isProtected(el);

  /**
   * Post-order walk: an element is a seed only when nothing inside it already
   * qualified, so we always start from the tightest promotional block.
   */
  const collectSeeds = (el, depth, out) => {
    if (!(el instanceof Element) || hider.isHidden(el)) return false;

    let seededBelow = false;
    if (depth < LIMITS.maxScanDepth) {
      for (const child of el.children) {
        if (collectSeeds(child, depth + 1, out)) seededBelow = true;
      }
    }
    if (seededBelow) return true;

    const text = readableText(el);
    if (text.length > LIMITS.maxBannerTextLength) return false; // too big to be a banner
    if (!isSeed(el, text)) return false;

    out.push(el);
    return true;
  };

  const isNegligible = (text) => text.length <= LIMITS.absorbableSiblingLength;

  /** A neighbour swept up by growing: fine if it is promo too, or basically empty. */
  const isAbsorbable = (text) =>
    isNegligible(text) || scoreText(text) >= LIMITS.absorbableSiblingScore;

  /**
   * Climb out of a seed to the full banner container.
   *
   * Two conditions, and both matter. Every neighbour we would swallow has to be
   * absorbable, which stops us eating real content. And there has to be positive
   * evidence the parent *is* the banner, otherwise a column of four harmless
   * cards (each scoring a stray point for "Learn more" or "per month") would
   * look absorbable and the whole column would vanish.
   */
  const growFromSeed = (seed) => {
    let current = seed;
    while (current.parentElement) {
      const parent = current.parentElement;
      if (isProtected(parent)) break;

      const parentText = readableText(parent);
      if (parentText.length > LIMITS.maxBannerTextLength) break;

      const neighbours = Array.from(parent.children)
        .filter((child) => child !== current && !hider.isHidden(child))
        .map(readableText);

      if (!neighbours.every(isAbsorbable)) break;

      const isBannerContainer =
        neighbours.length === 0 ||
        neighbours.every(isNegligible) ||
        neighbours.some(hasStrongWording) ||
        promoDensity(parentText) >= LIMITS.minGrowDensity;

      if (!isBannerContainer) break;
      current = parent;
    }
    return current;
  };

  const looksLikeModal = (el) =>
    safeMatches(el, MODAL_SELECTOR) || safeClosest(el, MODAL_SELECTOR) || hider.isFullScreenLayer(el);

  const sweepPromoBlocks = (root, settings) => {
    const result = { hidden: 0, hidModal: false };
    if (!(root instanceof Element)) return result;

    const seeds = [];
    for (const child of root.children) collectSeeds(child, 0, seeds);

    for (const seed of seeds) {
      if (hider.isHidden(seed)) continue; // already covered by an earlier banner

      const target = growFromSeed(seed);
      if (hider.isHidden(target)) continue;

      const modal = looksLikeModal(target);
      const allowed = modal ? settings.hideUpsellModals : settings.hidePromoBars;
      if (!allowed) continue;

      if (hider.hide(target, modal ? 'modal' : 'promo')) {
        result.hidden += 1;
        result.hidModal = result.hidModal || modal;
      }
    }
    return result;
  };

  /** Standalone Upgrade / Buy now chrome that is not part of a banner. */
  const sweepUpgradeButtons = (root) => {
    let hidden = 0;
    let buttons;
    try {
      buttons = root.querySelectorAll(UPGRADE_BUTTON_SELECTOR);
    } catch {
      return 0;
    }
    for (const button of buttons) {
      if (hider.isHidden(button)) continue;
      // Already gone with the banner it sat on, so do not count it twice.
      if (safeClosest(button, HIDDEN_SELECTOR)) continue;
      if (!UPGRADE_BUTTON_LABELS.has(normalise(button.textContent).toLowerCase())) continue;
      // A nag button on a real billing screen is a real control, so leave it.
      if (safeClosest(button, BILLING_CONTEXT_SELECTOR)) continue;
      if (hider.hide(button, 'upgrade-button')) hidden += 1;
    }
    return hidden;
  };

  /** Selectors the user picked by hand, stored per hostname. */
  const applyCustomSelectors = (root, selectors) => {
    let hidden = 0;
    for (const selector of selectors || []) {
      let matches;
      try {
        matches = root.querySelectorAll(selector);
      } catch (err) {
        console.warn('[Banner Declutter] ignoring invalid custom selector:', selector, err);
        continue;
      }
      for (const el of matches) {
        if (hider.hide(el, 'custom')) hidden += 1;
      }
    }
    return hidden;
  };

  /** One full pass over the document. Returns the number of blocks newly hidden. */
  const run = (settings) => {
    const root = document.body || document.documentElement;
    if (!root) return 0;

    let hidden = applyCustomSelectors(root, settings.customSelectors?.[location.hostname]);
    let hidModal = false;

    if (settings.hidePromoBars || settings.hideUpsellModals) {
      const sweep = sweepPromoBlocks(root, settings);
      hidden += sweep.hidden;
      hidModal = sweep.hidModal;
    }

    if (settings.hideUpgradeButtons) hidden += sweepUpgradeButtons(root);

    if (hidModal) {
      hider.restorePageScroll();
      hidden += hider.hideOrphanBackdrops();
    }
    return hidden;
  };

  NS.scanner = Object.freeze({
    run,
    scoreText,
    promoDensity,
    readableText,
    hasPromoWording,
    hasStrongWording,
    sweepPromoBlocks,
    sweepUpgradeButtons
  });
})();
