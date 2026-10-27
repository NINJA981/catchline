// Background: per-tab badge and rollup storage (ADR §3). The overlay injection and the Show all
// command arrive with the overlay in the UI stage.

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { applyBadge, type BadgeApi } from '../adapters/badge';
import { topFrameTabId } from '../adapters/sender';
import type { TabRollup } from '../core';
import { onMessage } from '../messaging/protocol';
import { clearTabRollup, setTabRollup } from '../storage/rollup';
import { getSettings } from '../storage/settings';

export default defineBackground(() => {
  const badge: BadgeApi = browser.action;

  onMessage('reportScan', async ({ data, sender }) => {
    const tabId = topFrameTabId(sender as unknown);
    if (tabId === null) return;
    const rollup: TabRollup = { ...data, tabId };
    await setTabRollup(rollup);
    const settings = await getSettings();
    await applyBadge(badge, tabId, settings.badge ? rollup : null);
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
});
