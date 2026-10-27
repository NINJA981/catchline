// User settings in chrome.storage.local (SPEC §7, §9): the extension adapter around the pure schema
// in src/core/settings.ts. Versioned with WXT storage. Nothing here is ever logged or sent anywhere.

import { storage } from 'wxt/utils/storage';
import {
  DEFAULT_SETTINGS,
  normalizeHost,
  SETTINGS_STORAGE_KEY,
  sanitizeSettings,
  type Settings,
} from '../core';

export { DEFAULT_SETTINGS, sanitizeSettings, type Settings };

export const settingsItem = storage.defineItem<Settings>(`local:${SETTINGS_STORAGE_KEY}`, {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export async function getSettings(): Promise<Settings> {
  return sanitizeSettings(await settingsItem.getValue());
}

export async function updateSettings(patch: Partial<Omit<Settings, 'version'>>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await settingsItem.setValue(next);
  return next;
}

/** Turn Catchline off (or back on) for one site. Returns the new disabled list. */
export async function setHostEnabled(host: string, enabled: boolean): Promise<string[]> {
  const h = normalizeHost(host);
  const current = await getSettings();
  const without = current.disabledHosts.filter((d) => d !== h);
  const disabledHosts = enabled ? without : [...without, h];
  const next = await updateSettings({ disabledHosts });
  return next.disabledHosts;
}

/** Calls back with sanitized settings whenever they change (AC-F11.1). Returns an unsubscribe. */
export function watchSettings(cb: (s: Settings) => void): () => void {
  return settingsItem.watch((value) => {
    cb(sanitizeSettings(value));
  });
}
