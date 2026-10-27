// Settings schema, defaults and repair (SPEC §7). Pure: no browser APIs, so the every-page scanner
// can read settings without bundling the storage wrapper.

import { normalizeHost } from './url';

/** chrome.storage.local key WXT uses for the 'local:settings' item. */
export const SETTINGS_STORAGE_KEY = 'settings';

export interface Settings {
  version: 1;
  runOn: 'all-sites' | 'on-click';
  /** Hostnames only. */
  disabledHosts: string[];
  /** Thin underline under detected markers. */
  markCatchesOnPage: boolean;
  badge: boolean;
  motion: 'system' | 'reduce';
  theme: 'system' | 'light' | 'dark';
  plainLine: { enabled: boolean; provider: 'on-device' | 'byo-key' };
  /** F12 BYO key, only if the user adds one (post-MVP; not used by any code path yet). */
  byoKey?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  runOn: 'all-sites',
  disabledHosts: [],
  markCatchesOnPage: true,
  badge: true,
  motion: 'system',
  theme: 'system',
  plainLine: { enabled: false, provider: 'on-device' },
};

/**
 * Repair whatever is in storage into a valid Settings object. Unknown fields are dropped and bad
 * values fall back to defaults, so a corrupted store never breaks the scanner.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const hosts = Array.isArray(r.disabledHosts)
    ? [
        ...new Set(
          r.disabledHosts
            .filter((h): h is string => typeof h === 'string')
            .map(normalizeHost)
            .filter((h) => h.length > 0 && h.length <= 253),
        ),
      ]
    : [];
  const pl = (r.plainLine && typeof r.plainLine === 'object' ? r.plainLine : {}) as Record<
    string,
    unknown
  >;
  const out: Settings = {
    version: 1,
    runOn: pick(r.runOn, ['all-sites', 'on-click'] as const, DEFAULT_SETTINGS.runOn),
    disabledHosts: hosts,
    markCatchesOnPage: bool(r.markCatchesOnPage, DEFAULT_SETTINGS.markCatchesOnPage),
    badge: bool(r.badge, DEFAULT_SETTINGS.badge),
    motion: pick(r.motion, ['system', 'reduce'] as const, DEFAULT_SETTINGS.motion),
    theme: pick(r.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    plainLine: {
      enabled: bool(pl.enabled, false),
      provider: pick(pl.provider, ['on-device', 'byo-key'] as const, 'on-device'),
    },
  };
  if (typeof r.byoKey === 'string' && r.byoKey.trim()) out.byoKey = r.byoKey.trim();
  return out;
}
