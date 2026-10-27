// Per-tab rollups in chrome.storage.session (SPEC §9): gone when the tab or browser closes.
// Holds counts and term strings only; no URLs, no page text. Extension adapter.

import { storage } from 'wxt/utils/storage';
import { isTabRollup, type TabRollup } from '../core';

type SessionKey = `session:${string}`;

export function rollupKey(tabId: number): SessionKey {
  return `session:rollup:${String(tabId)}`;
}

export async function setTabRollup(rollup: TabRollup): Promise<void> {
  await storage.setItem<TabRollup>(rollupKey(rollup.tabId), rollup);
}

export async function getTabRollup(tabId: number): Promise<TabRollup | null> {
  const value = await storage.getItem<unknown>(rollupKey(tabId));
  return isTabRollup(value) && value.tabId === tabId ? value : null;
}

export async function clearTabRollup(tabId: number): Promise<void> {
  await storage.removeItem(rollupKey(tabId));
}
