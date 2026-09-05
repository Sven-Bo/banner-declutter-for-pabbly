/**
 * Popup controller. Reads settings through the same storage module the content
 * script uses, and talks to the active tab for live counts and the picker.
 */
(() => {
  'use strict';

  const { storage } = globalThis.__pabblyDeclutter;

  const TOGGLES = ['hidePromoBars', 'hideUpgradeButtons', 'hideUpsellModals'];
  const PABBLY_HOST = /(^|\.)pabbly\.com$/i;

  const el = (id) => document.getElementById(id);
  const ui = {
    status: el('status'),
    foot: el('foot'),
    panel: el('panel'),
    enabled: el('enabled'),
    pick: el('pick'),
    reveal: el('reveal'),
    clear: el('clear')
  };

  let activeTab = null;

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /** Ask the content script what it did on this page. Null if it isn't there. */
  const askTab = async (type) => {
    if (!activeTab?.id) return null;
    try {
      return await chrome.tabs.sendMessage(activeTab.id, { type }, { frameId: 0 });
    } catch {
      return null; // no content script in this tab yet
    }
  };

  const setStatus = (text, tone) => {
    ui.status.textContent = text;
    if (tone) ui.status.dataset.tone = tone;
    else delete ui.status.dataset.tone;
  };

  const findPabblyTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    try {
      return PABBLY_HOST.test(new URL(tab.url).hostname) ? tab : null;
    } catch {
      return null;
    }
  };

  const refreshStatus = async (settings) => {
    if (!activeTab) {
      setStatus('Open a Pabbly tab to use this');
      for (const button of [ui.pick, ui.reveal, ui.clear]) button.disabled = true;
      return;
    }
    if (!settings.enabled) {
      setStatus('Paused, banners are showing');
      return;
    }
    const status = await askTab('PBB_STATUS');
    if (!status) {
      setStatus('Reload the tab to start hiding');
      return;
    }
    if (status.revealed) {
      setStatus('Everything is showing until you reload');
      return;
    }
    setStatus(
      status.hidden > 0
        ? `${plural(status.hidden, 'block', 'blocks')} hidden on this page`
        : 'Nothing to hide on this page',
      status.hidden > 0 ? 'on' : undefined
    );
  };

  const render = (settings) => {
    ui.enabled.checked = settings.enabled;
    ui.panel.dataset.disabled = String(!settings.enabled);
    for (const key of TOGGLES) el(key).checked = Boolean(settings[key]);
  };

  const patch = async (changes) => {
    const settings = await storage.save(changes);
    render(settings);
    await refreshStatus(settings);
  };

  const wire = () => {
    ui.enabled.addEventListener('change', () => patch({ enabled: ui.enabled.checked }));

    for (const key of TOGGLES) {
      el(key).addEventListener('change', () => patch({ [key]: el(key).checked }));
    }

    ui.pick.addEventListener('click', async () => {
      const started = await askTab('PBB_PICK');
      if (!started?.ok) {
        setStatus('Reload the tab, then try again');
        return;
      }
      window.close(); // get out of the way so the user can click the page
    });

    ui.reveal.addEventListener('click', async () => {
      const result = await askTab('PBB_REVEAL_ALL');
      if (result?.ok) {
        setStatus(`${plural(result.restored, 'block', 'blocks')} back until you reload`);
      }
    });

    ui.clear.addEventListener('click', async () => {
      await askTab('PBB_CLEAR_CUSTOM');
      ui.foot.textContent = 'Your hand-picked hides for this site are gone.';
      await refreshStatus(await storage.load());
    });
  };

  const init = async () => {
    try {
      activeTab = await findPabblyTab();
      const settings = await storage.load();
      render(settings);
      wire();
      await refreshStatus(settings);
    } catch (err) {
      console.error('[Banner Declutter] popup failed to start:', err);
      setStatus('Something went wrong, try reopening this');
    }
  };

  init();
})();
