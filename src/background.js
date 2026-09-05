/**
 * Service worker. Its only job: make the extension work on tabs that were
 * already open when it was installed or reloaded, so nobody has to hunt for
 * the refresh button.
 */
'use strict';

const CONTENT_SCRIPTS = [
  'src/config.js',
  'src/storage.js',
  'src/hider.js',
  'src/scanner.js',
  'src/picker.js',
  'src/content.js'
];

const CONTENT_STYLES = ['src/inject.css'];

const PABBLY_TABS = { url: ['*://pabbly.com/*', '*://*.pabbly.com/*'] };

const injectInto = async (tabId) => {
  try {
    await chrome.scripting.insertCSS({ target: { tabId, allFrames: true }, files: CONTENT_STYLES });
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: CONTENT_SCRIPTS });
  } catch (err) {
    // Chrome blocks injection into some tabs (discarded, pre-render, error pages).
    console.debug('[Banner Declutter] skipped tab', tabId, err?.message || err);
  }
};

const injectIntoOpenTabs = async () => {
  try {
    const tabs = await chrome.tabs.query(PABBLY_TABS);
    await Promise.all(tabs.map((tab) => (tab.id == null ? null : injectInto(tab.id))));
  } catch (err) {
    console.warn('[Banner Declutter] could not reach open tabs:', err);
  }
};

chrome.runtime.onInstalled.addListener(injectIntoOpenTabs);
chrome.runtime.onStartup.addListener(() => {
  /* Fresh tabs get the declared content script automatically — nothing to do. */
});
