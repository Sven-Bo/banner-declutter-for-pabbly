# Banner Declutter for Pabbly

A Chrome extension that removes Pabbly's promo banners, upgrade nags and upsell
popups. Not affiliated with or endorsed by Pabbly. It runs only on `pabbly.com` and its subdomains, and it hides things with
CSS — nothing is deleted, so everything comes back the moment you switch it off.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick this folder (`pabbly-declutter`)

Tabs that were already open get patched automatically on install. After that it
runs on every Pabbly page you load.

## What it hides

| Toggle | What goes |
|---|---|
| **Promo banners** | The pink/purple "[LIMITED TIME DEAL] … VIEW OFFER" strip, the "$99 for all Pabbly apps" panel on the login screen, and anything similarly worded |
| **Upgrade buttons** | Standalone `Upgrade` / `Buy now` / `View offer` chrome in the header |
| **Upsell popups** | Promo overlays, plus the dimmed backdrop and the scroll lock they leave behind |

Each is a separate switch in the toolbar popup, and there's a master switch to
pause the whole thing.

## When it misses something

Pabbly ships new banners regularly. Open the popup and press **"Hide something by
clicking it"** — the next thing you click is hidden for good on that hostname.
**"Reset my picks"** undoes those choices, and **"Show everything"** temporarily
puts everything back until you reload the page.

## How the detection works

It could just look for the word "deal" and hide whatever contains it, but that
fails immediately: a column of four unrelated cards ("save 25 records to Sheets",
"$29 billed monthly", "Learn more") collects enough stray signal to look like an
ad, and the whole page disappears. So it works in two phases:

1. **Seed** — find the *smallest* blocks that are densely promotional. A block
   needs strong wording (`limited time deal`, `lifetime access`, `25% off`), or
   two weaker signals plus a call to action. On top of that, the promo wording
   must cover at least 35% of the block's own text. That density test is what
   separates a banner (~75% signal) from a content column (~12%).
2. **Grow** — climb outwards from the seed so the whole banner goes as one unit
   rather than leaving an empty coloured strip. It only climbs while every
   neighbour it would swallow is itself promo or negligible, *and* there is
   positive evidence the parent really is the banner.

Three things are never touched, at any point: page scaffolding (`body`, `main`,
`#root`), any block containing a real form control, and anything inside a genuine
pricing, billing or checkout screen — so real "Buy now" buttons keep working.

## Layout

```
manifest.json          MV3 manifest
src/config.js          Phrases, selectors, thresholds — all frozen, all in one place
src/storage.js         chrome.storage.sync wrapper; every write is a merge, never a mutation
src/hider.js           The only file that touches visibility. Reversible by design
src/scanner.js         Seed-and-grow detection
src/picker.js          Click-to-hide picker and selector generation
src/content.js         Boot, MutationObserver, SPA route changes, popup messages
src/background.js      Injects into tabs that were open at install time
src/inject.css         The hide rule plus picker chrome
popup/                 Toolbar UI
tests/fixture.html     22 assertions against a replica of the real pages
store/shots.html       Source for the Web Store screenshots
store/*.png            Rendered 1280x800 listing screenshots
dist/*.zip             Web Store upload package
tools/make-icons.py    Regenerates the icons (pure stdlib, no build step)
tools/make-screenshots.py  Renders store/*.png via Playwright
tools/package.py       Builds the upload zip
```

## Tests

`tests/fixture.html` is a replica of the Pabbly dashboard and login screens, with
the real banner copy alongside deliberate false-positive bait (a workflow named
"Save 25 records", a "Learn more" help card, a "$29 billed monthly" pricing card).
It loads the real detection source and asserts what must vanish and what must
survive.

```bash
python -m http.server 8777
```

Then open <http://localhost:8777/tests/fixture.html>. The page prints PASS/FAIL
per case plus the measured score and density of each block, which is how the
thresholds in `src/config.js` were chosen.

## Publishing

```bash
python tools/package.py
```

Writes `dist/banner-declutter-for-pabbly-<version>.zip` with `manifest.json` at
the archive root (the store rejects it otherwise) and only the files the manifest
actually references — no tests, no tooling. It fails loudly if the manifest points
at something the package omits. Bump `version` in `manifest.json` before every
re-upload.

Listing screenshots live in `store/` at the required 1280x800. Regenerate them
after any UI change:

```bash
python tools/make-screenshots.py
```

Permission justifications for the store's privacy tab:

- **`storage`** — stores the user's toggles and hand-picked hides so preferences
  persist and sync across their own devices.
- **`scripting`** — applies the extension to Pabbly tabs that were already open at
  install time, so no reload is needed. Injects only the extension's own files.
- **Host permission** — the extension's entire function is inside the Pabbly web
  app, so it runs only on `pabbly.com`.
- **Remote code:** no. **Data collection:** none; it makes no network requests.

## Notes

- No network access, no analytics, no permissions beyond `pabbly.com`.
- Settings sync through your Chrome profile, so your picks follow you between machines.
- If hiding a top banner ever leaves a gap, it means that page pads itself for a
  fixed bar. Point the picker at the gap, or add a rule to `src/inject.css`.
