// Toolbar badge adapter (SPEC F7). Takes the browser.action surface as a parameter so it can be
// tested with a fake.

import { badgeText, badgeTitle, type TabRollup } from '../core';

/** DESIGN.md `prussian` (oklch(0.45 0.10 238)) as the sRGB hex the badge API requires. */
export const BADGE_BACKGROUND = '#005c86';
/** DESIGN.md `on-prussian` (oklch(0.99 0.004 238)) as sRGB hex. */
export const BADGE_TEXT = '#f9fcfe';

export interface BadgeApi {
  setBadgeText(details: { tabId: number; text: string }): Promise<void> | void;
  setTitle(details: { tabId: number; title: string }): Promise<void> | void;
  setBadgeBackgroundColor(details: { tabId: number; color: string }): Promise<void> | void;
  setBadgeTextColor?: (details: { tabId: number; color: string }) => Promise<void> | void;
}

/** Show the rollup on one tab's badge, or clear it when `rollup` is null. */
export async function applyBadge(
  api: BadgeApi,
  tabId: number,
  rollup: TabRollup | null,
): Promise<void> {
  const text = badgeText(rollup);
  await api.setBadgeText({ tabId, text });
  await api.setTitle({ tabId, title: badgeTitle(rollup) });
  if (text) {
    await api.setBadgeBackgroundColor({ tabId, color: BADGE_BACKGROUND });
    await api.setBadgeTextColor?.({ tabId, color: BADGE_TEXT });
  }
}
