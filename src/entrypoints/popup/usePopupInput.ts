// Gathers the popup's inputs from the browser and exposes its actions. All view decisions live in
// core/state/popup.ts. `?tab=<id>` points the popup at a specific tab (used by tests and by the
// screenshot script, which open the popup in a normal tab).

import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import {
  hostnameOf,
  orderSummaries,
  SKELETON_DELAY_MS,
  type CatchSummary,
  type PopupInput,
  type TabRollup,
} from '../../core';
import { sendMessage, sendToTab } from '../../messaging/protocol';
import { getTabRollup } from '../../storage/rollup';
import { getSettings, setHostEnabled, watchSettings } from '../../storage/settings';

interface Loaded {
  ready: boolean;
  tabId: number | null;
  url: string | null;
  disabledHosts: string[];
  runOn: 'all-sites' | 'on-click';
  hasHostPermission: boolean;
  rollup: TabRollup | null;
  catches: CatchSummary[];
  scannerError: boolean;
  theme: 'system' | 'light' | 'dark';
  motion: 'system' | 'reduce';
}

const EMPTY: Loaded = {
  ready: false,
  tabId: null,
  url: null,
  disabledHosts: [],
  runOn: 'all-sites',
  hasHostPermission: true,
  rollup: null,
  catches: [],
  scannerError: false,
  theme: 'system',
  motion: 'system',
};

export interface PopupModel {
  input: PopupInput;
  catches: CatchSummary[];
  host: string | null;
  enabledOnSite: boolean;
  theme: Loaded['theme'];
  motion: Loaded['motion'];
  toggleSite: (next: boolean) => void;
  showAll: () => void;
  reveal: (id: string) => void;
  allowAllSites: () => void;
  reloadPage: () => void;
  openOptions: () => void;
  openWelcome: () => void;
}

function tabOverride(): number | null {
  const v = new URLSearchParams(location.search).get('tab');
  const n = v ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function usePopupInput(): PopupInput {
  return usePopup().input;
}

export function usePopup(): PopupModel {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [pastDelay, setPastDelay] = useState(false);
  const tabRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setPastDelay(true);
    }, SKELETON_DELAY_MS);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const load = useCallback(async () => {
    const override = tabOverride();
    const tab =
      override !== null
        ? await browser.tabs.get(override).catch(() => undefined)
        : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
    const tabId = tab?.id ?? null;
    tabRef.current = tabId;
    urlRef.current = tab?.url ?? null;
    const [settings, rollup, hasHostPermission] = await Promise.all([
      getSettings(),
      tabId !== null ? getTabRollup(tabId) : Promise.resolve(null),
      browser.permissions.contains({ origins: ['<all_urls>'] }),
    ]);
    const host = hostnameOf(tab?.url);
    const off = host !== null && settings.disabledHosts.includes(host);
    let catches: CatchSummary[] = [];
    let scannerError = false;
    if (tabId !== null && tab?.url && hasHostPermission && !off && host) {
      try {
        if (settings.runOn === 'on-click') await sendToTab(tabId, 'rescan');
        catches = orderSummaries(await sendToTab(tabId, 'listCatches'));
      } catch {
        scannerError = true;
      }
    }
    setLoaded({
      ready: true,
      tabId,
      url: tab?.url ?? null,
      disabledHosts: settings.disabledHosts,
      runOn: settings.runOn,
      hasHostPermission,
      rollup: scannerError ? null : rollup,
      catches,
      scannerError,
      theme: settings.theme,
      motion: settings.motion,
    });
  }, []);

  useEffect(() => {
    void load();
    // Settings changes (the per-site toggle) apply without reopening the popup (AC-F10.3).
    const off = watchSettings(() => {
      void load();
    });
    const onSession = (_c: unknown, area: string) => {
      if (area === 'session') void load();
    };
    browser.storage.onChanged.addListener(onSession);
    return () => {
      off();
      browser.storage.onChanged.removeListener(onSession);
    };
  }, [load]);

  const host = hostnameOf(loaded.url);

  return {
    input: {
      url: loaded.url,
      disabledHosts: loaded.disabledHosts,
      hasHostPermission: loaded.hasHostPermission,
      rollup: loaded.rollup,
      scannerError: loaded.scannerError,
      elapsedMs: pastDelay ? SKELETON_DELAY_MS : 0,
      ready: loaded.ready,
    },
    catches: loaded.catches,
    host,
    enabledOnSite: host !== null && !loaded.disabledHosts.includes(host),
    theme: loaded.theme,
    motion: loaded.motion,
    toggleSite(next) {
      if (host) void setHostEnabled(host, next);
    },
    showAll() {
      const tabId = tabRef.current;
      if (tabId === null) return;
      void sendMessage('openOverlay', { req: { kind: 'show-all' }, tabId }).then(() => {
        if (tabOverride() === null) window.close();
      });
    },
    reveal(id) {
      const tabId = tabRef.current;
      if (tabId === null) return;
      void sendMessage('openOverlay', { req: { kind: 'card', id }, tabId }).then(() => {
        if (tabOverride() === null) window.close();
      });
    },
    allowAllSites() {
      void browser.permissions.request({ origins: ['<all_urls>'] }).then((granted) => {
        if (granted) void load();
      });
    },
    reloadPage() {
      const tabId = tabRef.current;
      if (tabId !== null) void browser.tabs.reload(tabId);
      if (tabOverride() === null) window.close();
    },
    openOptions() {
      void browser.runtime.openOptionsPage();
      if (tabOverride() === null) window.close();
    },
    openWelcome() {
      void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
      if (tabOverride() === null) window.close();
    },
  };
}
