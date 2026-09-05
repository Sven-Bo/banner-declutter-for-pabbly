# Chrome Web Store listing copy

Everything the "Store listing" and "Privacy practices" tabs ask for. The store
renders the description as **plain text**, no markdown and no HTML, so the caps
headings and `•` bullets below are deliberate. Keep it that way.

---

## Title (read-only, comes from manifest.json)

Banner Declutter for Pabbly

## Summary (read-only, comes from manifest.json `description`)

Hides Pabbly's promo banners, upgrade nags and upsell popups. Not affiliated with Pabbly.

## Category

**Functionality & UI**, the category for extensions that change how an existing
site looks or behaves. Second choice: Workflow & Planning.

## Language

English (United States)

## Description

Paste everything between the rules, exactly as-is.

---

Pabbly Connect is a capable tool that ships with a lot of promotional noise. This extension removes it.

WHAT IT HIDES

• Promo banners: the "[LIMITED TIME DEAL] ... VIEW OFFER" strip across the top of the dashboard, the "$99 for all Pabbly apps" panel on the login screen, and anything worded like them.
• Upgrade buttons: standalone "Upgrade" and "Buy now" chrome in the app header.
• Upsell popups: promotional overlays, plus the dimmed backdrop and the page scroll lock they leave behind.

Each one is a separate switch in the toolbar popup, and a master switch pauses everything at once.

NOTHING IS DELETED

Blocks are hidden with CSS, never removed from the page. Turn the extension off and Pabbly looks exactly as it shipped. Pricing, billing and checkout screens are off-limits by design, so real purchase buttons keep working.

WHEN IT MISSES ONE

New banners show up regularly. Open the popup, click "Hide something by clicking it", then click the offending element. It stays hidden on that site from then on. "Reset my picks" undoes those choices, and "Show everything" puts them back until you reload.

HOW IT DECIDES

It does not simply search for the word "deal". It looks for blocks where promotional wording covers a real share of the text, around 75% for a banner against around 12% for an ordinary content column, then expands outwards only while the surrounding content is promotional too. That is what stops it swallowing your workflow list.

PRIVACY

No tracking, no analytics, no network requests of any kind. Permissions stop at pabbly.com, so the extension cannot see or run on any other site. Settings are stored in your own Chrome profile.

Not affiliated with, endorsed by, or sponsored by Pabbly. "Pabbly" is a trademark of its respective owner, used here only to describe what this extension works with.

---

## Graphic assets

| Field | File | Size |
|---|---|---|
| Store icon (required) | `icons/icon128.png` | 128×128 |
| Screenshot 1 (at least one required) | `store/screenshot-1-before-after.png` | 1280×800 |
| Screenshot 2 | `store/screenshot-2-controls.png` | 1280×800 |
| Screenshot 3 | `store/screenshot-3-picker.png` | 1280×800 |
| Small promo tile (optional) | `store/promo-tile-small.png` | 440×280 |
| Marquee promo tile (optional) | none | 1400×560 |

The marquee tile only matters if Google ever features the extension. Skip it.

`store/github-header.png` (1280×400) is for the repo README, not the store.

## Additional fields further down the page

- **Official URL / Homepage URL / Support URL**: optional. A page on your own site,
  or leave blank.
- **Mature content**: No.
- **Visibility**: Unlisted gives a working install link without appearing in search.
  Public if you want discovery.

---

# Privacy practices tab

Save Draft after filling this in. The tab does not autosave.

## Single purpose description

This extension has one purpose: to hide promotional content, meaning deal banners, upgrade prompts and upsell overlays, inside the Pabbly web application at pabbly.com, so the user can work in an uncluttered interface. It does nothing else and runs nowhere else.

## Host permission justification (`*://pabbly.com/*`, `*://*.pabbly.com/*`)

The extension's entire function takes place inside the Pabbly web app, so it needs to run a content script on Pabbly pages. Access is limited to pabbly.com and its subdomains; no other site is requested or accessible. On those pages the script reads the page's own DOM to identify promotional blocks by their wording, then applies a CSS rule that hides them. Nothing is read for any other purpose, and no page data leaves the device.

## `scripting` justification

Used only at install and update time, to inject the extension's own bundled content scripts into Pabbly tabs that are already open. Without it the user would have to manually reload every open Pabbly tab before the extension did anything. It injects only files packaged inside the extension (src/*.js and src/inject.css), never remote, generated or user-supplied code, and only into tabs already covered by the pabbly.com host permission.

## `storage` justification

Stores the user's own preferences: the master on/off switch, the three category toggles (promo banners, upgrade buttons, upsell popups), and the list of elements the user chose to hide by hand with the click-to-hide picker. This is what makes those choices survive a browser restart and follow the user across their own Chrome profiles. No personal data, browsing history or page content is stored, and nothing is transmitted off the device.

## Remote code

Select **"No, I am not using remote code."** If a text box appears anyway:

The extension contains no remote code. All JavaScript and CSS is packaged in the extension bundle. It makes no network requests, loads no external scripts or stylesheets, and uses no eval() or other dynamic code execution.

## Data usage

Leave **every** data-type checkbox unchecked. The extension collects nothing and
transmits nothing; reading the DOM on-device is not collection.

Then tick all three certification boxes:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

---

# Settings page (left nav → Account / Settings)

1. Enter a **publisher contact email**.
2. Click **Verify**, then click the link Google emails you.

This is separate from the listing and applies to the whole developer account, so it
is a one-time step.
