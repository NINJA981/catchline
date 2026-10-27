// Background: per-tab badge and rollup storage, overlay injection, the Show all command and the
// welcome page on install (ADR 0001 section 3).

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { applyBadge, type BadgeApi } from '../adapters/badge';
import { topFrameTabId } from '../adapters/sender';
import type { TabRollup } from '../core';
import { onMessage, sendToTab } from '../messaging/protocol';
import type { OverlayRequest } from '../overlay/bridge';
import { clearTabRollup, getTabRollup, setTabRollup } from '../storage/rollup';
import { getSettings, watchSettings } from '../storage/settings';

/**
 * Runs in the page's isolated world, where the scanner left its bridge. Returns true when the
 * overlay took the request, false when it parked it for the overlay's first mount, and null when no
 * scanner is running on the page.
 */
function dispatchInPage(req: OverlayRequest): boolean | null {
  const bridge = (globalThis as Record<symbol, unknown>)[Symbol.for('catchline.bridge')] as
    | {
        overlay: { dispatch(r: OverlayRequest): void } | null;
        pending: OverlayRequest | null;
      }
    | undefined;
  if (!bridge) return null;
  if (bridge.overlay) {
    bridge.overlay.dispatch(req);
    return true;
  }
  bridge.pending = req;
  return false;
}

async function openOverlay(tabId: number, req: OverlayRequest): Promise<void> {
  const [first] = await browser.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: dispatchInPage,
    args: [req],
  });
  if (first?.result === false) {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ['/content-scripts/overlay.js'],
    });
  }
}

export default defineBackground(() => {
  const badge: BadgeApi = browser.action;

  onMessage('reportScan', async (data, sender) => {
    const tabId = topFrameTabId(sender);
    if (tabId === null) return;
    const rollup: TabRollup = { ...data, tabId };
    await setTabRollup(rollup);
    const settings = await getSettings();
    await applyBadge(badge, tabId, settings.badge ? rollup : null);
  });

  onMessage('openOverlay', async (data, sender) => {
    const tabId = data.tabId ?? topFrameTabId(sender);
    if (tabId === null) return;
    try {
      await openOverlay(tabId, data.req);
    } catch {
      // Restricted page or the tab went away: nothing to show.
    }
  });

  // The badge clears on navigation and is per tab (AC-F7.3).
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading' && info.url !== undefined) {
      void clearTabRollup(tabId);
      void applyBadge(badge, tabId, null);
    }
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void clearTabRollup(tabId);
  });

  // The badge setting reaches every open tab at once.
  watchSettings((settings) => {
    void (async () => {
      const tabs = await browser.tabs.query({});
      for (const t of tabs) {
        if (t.id === undefined) continue;
        const rollup = await getTabRollup(t.id);
        if (rollup) await applyBadge(badge, t.id, settings.badge ? rollup : null);
      }
    })();
  });

  // Alt+Shift+C: Show all catches on this page (AC-F6.1).
  browser.commands.onCommand.addListener((command) => {
    if (command !== 'show-all') return;
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) return;
      try {
        await sendToTab(tab.id, 'rescan');
      } catch {
        return; // no scanner on this page
      }
      try {
        await openOverlay(tab.id, { kind: 'show-all' });
      } catch {
        // Restricted page.
      }
    })();
  });

  // The welcome page opens once, on install.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
    }
  });
});
