// Every-page scanner (ADR §3): vanilla TypeScript, no React. Scans after the page settles, reports
// the rollup to the background, and rescans on DOM changes and SPA navigation.
// This file is the extension adapter; all scanning logic is in src/core.

import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  analyze,
  buildRollup,
  createComputedStyleOracle,
  isHostDisabled,
  orderSummaries,
  sanitizeSettings,
  SETTINGS_STORAGE_KEY,
  toCatchSummary,
  type Analysis,
} from '../core';
import { createRescanObserver } from '../dom/observe';
import { onMessage, sendMessage } from '../messaging/protocol';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main(ctx) {
    // Direct read keeps the storage wrapper out of the every-page bundle (ADR §6 budget).
    const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    const settings = sanitizeSettings(stored[SETTINGS_STORAGE_KEY]);
    if (settings.runOn !== 'all-sites') return;
    if (isHostDisabled(location.hostname, settings.disabledHosts)) return;

    let last: Analysis | null = null;
    let known = new Set<string>();

    const scan = (): number => {
      // A fresh oracle per scan: computed styles change as the page changes.
      last = analyze(document, createComputedStyleOracle(window));
      const ids = new Set(last.catches.map((c) => c.marker.id));
      let fresh = 0;
      for (const id of ids) if (!known.has(id)) fresh++;
      known = ids;
      const { tabId: _unused, ...report } = buildRollup(-1, last.catches, Date.now());
      void sendMessage('reportScan', report).catch(() => undefined);
      return fresh;
    };

    onMessage('listCatches', () => orderSummaries((last?.catches ?? []).map(toCatchSummary)));
    onMessage('rescan', () => {
      scan();
    });

    ctx.requestIdleCallback(() => scan(), { timeout: 2000 });

    const observer = createRescanObserver(document.body, scan);
    ctx.onInvalidated(() => {
      observer.disconnect();
    });
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      known = new Set();
      observer.rearm();
      scan();
    });
  },
});
