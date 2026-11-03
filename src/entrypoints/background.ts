// Background: per-tab badge and rollup storage, overlay injection, the Show all command and the
// welcome page on install (ADR 0001 section 3).

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { applyBadge, type BadgeApi } from '../adapters/badge';
import { isExtensionPage, topFrameTabId } from '../adapters/sender';
import { isTabRollup } from '../core';
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

/** Shape check for a request that arrived in a message (untrusted input). */
function isOverlayRequest(v: unknown): v is OverlayRequest {
  if (!v || typeof v !== 'object') return false;
  const r = v as { kind?: unknown; id?: unknown };
  if (r.kind === 'show-all' || r.kind === 'close') return true;
  return r.kind === 'card' && typeof r.id === 'string' && r.id.length <= 64;
}

// One injection at a time per tab, so two quick requests cannot both inject the overlay.
const tabQueue = new Map<number, Promise<void>>();

function openOverlay(tabId: number, req: OverlayRequest): Promise<void> {
  const prev = tabQueue.get(tabId) ?? Promise.resolve();
  const next = prev.then(
    () => injectAndDispatch(tabId, req),
    () => injectAndDispatch(tabId, req),
  );
  const tail = next.catch(() => undefined);
  tabQueue.set(tabId, tail);
  void tail.then(() => {
    if (tabQueue.get(tabId) === tail) tabQueue.delete(tabId);
  });
  return next;
}

async function injectAndDispatch(tabId: number, req: OverlayRequest): Promise<void> {
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
    const rollup: unknown = { ...data, tabId };
    if (!isTabRollup(rollup)) return;
    await setTabRollup(rollup);
    const settings = await getSettings();
    await applyBadge(badge, tabId, settings.badge ? rollup : null);
  });

  onMessage('openOverlay', async (data, sender) => {
    if (!isOverlayRequest(data.req)) return;
    // A content script can only address its own tab; only an extension page (the popup) names one.
    const named =
      typeof data.tabId === 'number' && Number.isInteger(data.tabId) ? data.tabId : null;
    const tabId = isExtensionPage(sender, browser.runtime.getURL('/'))
      ? (named ?? null)
      : topFrameTabId(sender);
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
