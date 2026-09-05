/**
 * Shared configuration: what counts as a promo, and where we are never allowed
 * to touch the page. Everything here is frozen; nothing mutates it at runtime.
 */
(() => {
  'use strict';

  const NS = (globalThis.__pabblyDeclutter ||= {});
  if (NS.config) return;

  /** Storage key + defaults. `customSelectors` is keyed by hostname. */
  const STORAGE_KEY = 'pbb.settings';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    hidePromoBars: true,
    hideUpgradeButtons: true,
    hideUpsellModals: true,
    customSelectors: Object.freeze({})
  });

  /**
   * Strong signals: a single match is enough to call a block "promo".
   * Kept deliberately wordy so they can't fire on a workflow name.
   */
  const STRONG_PATTERNS = Object.freeze([
    /limited[\s-]?time\s+(deal|offer)/i,
    /stop\s+paying\s+for\s+multiple\s+subscriptions/i,
    /unlimited\s+access\s+to\s+all\s+pabbly/i,
    /get\s+unlimited\s+tasks?/i,
    /lifetime\s+(deal|access|plan)/i,
    /flash\s+sale/i,
    /(black\s+friday|cyber\s+monday|new\s+year|festive|christmas|anniversary)\s+(sale|deal|offer)/i,
    /save\s+\d{1,2}\s*%\s*(today|now)/i,
    /\d{1,2}\s*%\s+(off|discount)\b/i,
    /\b(3|three)[\s-]year\s+plan\b/i,
    /upgrade\s+(now\s+)?(and|to)\s+(save|get|unlock)/i,
    /one\s+single\s+price/i
  ]);

  /** Weak signals: two of these (or one plus a CTA) make a promo. */
  const WEAK_PATTERNS = Object.freeze([
    /\bhurry\b/i,
    /\bends\s+(in|soon|today|tonight)\b/i,
    /\blast\s+chance\b/i,
    /don'?t\s+miss\s+(out|this)/i,
    /\boffer\s+(valid|expires|ending|ends)/i,
    /\b(exclusive|special)\s+(deal|offer|price|pricing)\b/i,
    /\bsave\s+(up\s+to\s+)?\d/i,
    /\bunlimited\s+(tasks|workflows|apps|access)\b/i,
    /\bbilled\s+(annually|yearly|monthly)\b/i,
    /\bper\s+(month|year)\b/i,
    /\$\s?\d+(\.\d+)?\s*(\/|per\b)/i
  ]);

  /** Button wording that usually sits on a promo bar. */
  const CTA_PATTERNS = Object.freeze([
    /\bview\s+offer\b/i,
    /\bgrab\s+(the\s+)?(deal|offer)\b/i,
    /\bclaim\s+(your\s+)?(deal|offer|discount)\b/i,
    /\bget\s+the\s+deal\b/i,
    /\bbuy\s+now\b/i,
    /\bupgrade\s+now\b/i,
    /\bsubscribe\s+now\b/i,
    /\bsee\s+plans?\b/i,
    /\blearn\s+more\b/i
  ]);

  /** Standalone nag buttons, matched on their exact trimmed label. */
  const UPGRADE_BUTTON_LABELS = Object.freeze(new Set([
    'upgrade',
    'upgrade now',
    'upgrade plan',
    'upgrade account',
    'view offer',
    'buy now',
    'claim offer',
    'get unlimited'
  ]));

  const UPGRADE_BUTTON_SELECTOR = 'a, button, [role="button"]';

  /**
   * A nag button inside one of these is probably a real control on a real
   * billing screen, so we leave it alone.
   */
  const BILLING_CONTEXT_SELECTOR = [
    'form',
    '[class*="pricing" i]',
    '[class*="checkout" i]',
    '[class*="billing" i]',
    '[id*="pricing" i]'
  ].join(', ');

  /** Structural nodes we must never collapse; hiding these blanks the app. */
  const NEVER_HIDE_SELECTOR = [
    'html', 'head', 'body', 'main', 'script', 'style', 'link',
    '[role="main"]',
    '#root', '#app', '#__next', '#__nuxt',
    '[data-pbb-keep]'
  ].join(', ');

  /** If a block owns a real control, it is functional UI, not an ad. */
  const FORM_CONTROL_SELECTOR =
    'input:not([type="hidden"]), textarea, select, [contenteditable="true"]';

  /** Overlay/backdrop layers that get orphaned when we kill an upsell modal. */
  const MODAL_SELECTOR =
    '[role="dialog"], [class*="modal" i], [class*="popup" i], [class*="dialog" i]';

  const BACKDROP_SELECTOR =
    '[class*="backdrop" i], [class*="overlay" i], [class*="modal-open" i]';

  /** Body/html classes that lock scrolling while a modal is up. */
  const SCROLL_LOCK_CLASS_PATTERN = /(modal-open|overflow-hidden|no-scroll|scroll-lock|body-lock)/i;

  const LIMITS = Object.freeze({
    /** A promo block longer than this is almost certainly real content. */
    maxBannerTextLength: 1400,
    /** How deep the top-down sweep walks before giving up. */
    maxScanDepth: 16,
    /** Debounce for re-scans once the page has settled. */
    scanDebounceMs: 60,
    /** For this long after load we scan synchronously, so nothing flashes. */
    eagerWindowMs: 4000,
    /** Score at which a neighbouring block counts as promo too while growing. */
    absorbableSiblingScore: 1,
    /** Share of a seed's own text that must be promo wording (0-1). */
    minSeedDensity: 0.35,
    /** The same test, looser, applied to each block we grow into. */
    minGrowDensity: 0.22,
    /** Blocks this short skip the density test - a 3-word banner is all signal. */
    shortTextBypass: 40,
    /** A neighbour under this many characters can be swallowed while growing. */
    absorbableSiblingLength: 60,
    /** Cap on how many `alt`/`aria-label` strings we fold into the scored text. */
    maxLabelSamples: 6
  });

  NS.config = Object.freeze({
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    STRONG_PATTERNS,
    WEAK_PATTERNS,
    CTA_PATTERNS,
    UPGRADE_BUTTON_LABELS,
    UPGRADE_BUTTON_SELECTOR,
    BILLING_CONTEXT_SELECTOR,
    NEVER_HIDE_SELECTOR,
    FORM_CONTROL_SELECTOR,
    MODAL_SELECTOR,
    BACKDROP_SELECTOR,
    SCROLL_LOCK_CLASS_PATTERN,
    LIMITS
  });
})();
