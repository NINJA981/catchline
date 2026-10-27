// Gathers the popup's inputs from the browser. All view decisions live in state/popup.ts.

import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { TabRollup } from '../../core';
import { SKELETON_DELAY_MS, type PopupInput } from '../../core';
import { getTabRollup } from '../../storage/rollup';
import { getSettings } from '../../storage/settings';

interface Loaded {
  url: string | null;
  disabledHosts: string[];
  hasHostPermission: boolean;
  rollup: TabRollup | null;
}

const EMPTY: Loaded = { url: null, disabledHosts: [], hasHostPermission: true, rollup: null };

export function usePopupInput(): PopupInput {
  const [loaded, setLoaded] = useState<Loaded>(EMPTY);
  const [pastDelay, setPastDelay] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setPastDelay(true);
    }, SKELETON_DELAY_MS);
    return () => {
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const [settings, rollup, hasHostPermission] = await Promise.all([
        getSettings(),
        tab?.id !== undefined ? getTabRollup(tab.id) : Promise.resolve(null),
        browser.permissions.contains({ origins: ['<all_urls>'] }),
      ]);
      if (!run.cancelled) {
        setLoaded({
          url: tab?.url ?? null,
          disabledHosts: settings.disabledHosts,
          hasHostPermission,
          rollup,
        });
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, []);

  return {
    ...loaded,
    scannerError: false,
    elapsedMs: pastDelay ? SKELETON_DELAY_MS : 0,
  };
}
