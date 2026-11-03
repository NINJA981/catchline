// Every-page scanner (ADR 0001 section 3): vanilla TypeScript, no React. Scans after the page
// settles, reports the rollup to the background, draws the marker hit targets, and rescans on DOM
// changes and SPA navigation. It owns the bridge the on-demand overlay reads. All scanning logic is
// in src/core; this file is the extension adapter.

import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  analyzeSliced,
  buildRollup,
  createComputedStyleOracle,
  isHostDisabled,
  orderSummaries,
  sanitizeSettings,
  SETTINGS_STORAGE_KEY,
  toCatchSummary,
  type Analysis,
  type Settings,
} from '../core';
import { createRescanObserver, type RescanObserver } from '../dom/observe';
import { onMessage, sendMessage } from '../messaging/protocol';
import { dispatchToOverlay, setBridge, type Bridge, type OverlayRequest } from '../overlay/bridge';
import { createMarkerLayer } from '../overlay/markers-layer';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main(ctx) {
    // Direct read keeps the storage wrapper out of the every-page bundle (ADR budget).
    const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    let settings: Settings = sanitizeSettings(stored[SETTINGS_STORAGE_KEY]);

    let last: Analysis | null = null;
    let known = new Set<string>();
    let observer: RescanObserver | null = null;
    /** 'on-click' mode scans once the popup or shortcut asks, then keeps watching this page. */
    let armed = false;
    const analysisSubs = new Set<() => void>();
    const settingsSubs = new Set<() => void>();

    const enabled = () =>
      !isHostDisabled(location.hostname, settings.disabledHosts) &&
      (settings.runOn === 'all-sites' || armed);

    // Hovering or focusing a marker loads the overlay ahead of the click, so the first card does not
    // wait for the script to compile (about 150 ms on a laptop). Nothing is mounted visibly.
    let warmed = false;
    const markers = createMarkerLayer({
      onOpen: (id) => {
        request({ kind: 'card', id });
      },
      onIntent: () => {
        if (warmed || bridge.overlay) return;
        warmed = true;
        void sendMessage('openOverlay', { req: { kind: 'close' } }).catch(() => undefined);
      },
    });

    const bridge: Bridge = {
      getAnalysis: () => last,
      onAnalysis: (cb) => {
        analysisSubs.add(cb);
        return () => analysisSubs.delete(cb);
      },
      getSettings: () => settings,
      onSettings: (cb) => {
        settingsSubs.add(cb);
        return () => settingsSubs.delete(cb);
      },
      hostname: location.hostname.replace(/^www\./, ''),
      urlFor: (path) => browser.runtime.getURL(`/${path}` as '/popup.html'),
      rescan: () => {
        setTimeout(() => {
          void scan();
        }, 0);
      },
      focusMarker: (id) => {
        markers.focus(id);
      },
      overlay: null,
      pending: null,
    };
    setBridge(bridge);

    function request(req: OverlayRequest): void {
      if (dispatchToOverlay(bridge, req)) return;
      void sendMessage('openOverlay', { req }).catch(() => undefined);
    }

    function report(catches: Analysis['catches']): void {
      const { tabId: _unused, ...rollup } = buildRollup(-1, catches, Date.now());
      void sendMessage('reportScan', rollup).catch(() => undefined);
    }

    // One scan at a time. A request that arrives mid-scan runs once more when it finishes.
    let scanning: Promise<number> | null = null;
    const queue = { again: false };
    const wantsAgain = (): boolean => queue.again;

    function scan(): Promise<number> {
      if (scanning) {
        queue.again = true;
        return scanning;
      }
      const run = (async () => {
        let fresh = 0;
        do {
          queue.again = false;
          fresh += await scanOnce();
        } while (wantsAgain());
        return fresh;
      })();
      scanning = run;
      void run.finally(() => {
        scanning = null;
      });
      return run;
    }

    /** Hands the thread back every 8 ms so a big page never gets one long task (ADR section 3). */
    function yieldToMain(): Promise<void> {
      const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
      if (sched?.yield) return sched.yield();
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    async function scanOnce(): Promise<number> {
      if (!enabled()) return 0;
      // A fresh oracle per scan: computed styles change as the page changes.
      const result = await analyzeSliced(document, createComputedStyleOracle(window), {
        now: () => performance.now(),
        yieldToMain,
      });
      // The page may have been switched off while the scan was yielding.
      if (!enabled()) return 0;
      last = result;
      const ids = new Set(last.catches.map((c) => c.marker.id));
      let fresh = 0;
      for (const id of ids) if (!known.has(id)) fresh++;
      known = ids;
      markers.update(last.catches);
      report(last.catches);
      analysisSubs.forEach((cb) => {
        cb();
      });
      return fresh;
    }

    function start(immediate = false): void {
      if (observer) {
        observer.rearm();
      } else {
        observer = createRescanObserver(document.body, scan);
      }
      if (immediate) void scan();
      else
        ctx.requestIdleCallback(
          () => {
            void scan();
          },
          { timeout: 2000 },
        );
    }

    function stop(): void {
      observer?.disconnect();
      observer = null;
      last = null;
      known = new Set();
      markers.update([]);
      report([]);
      bridge.overlay?.dispatch({ kind: 'close' });
      analysisSubs.forEach((cb) => {
        cb();
      });
    }

    function applyDisplaySettings(): void {
      markers.setQuiet(!settings.markCatchesOnPage);
      markers.setTheme(settings.theme);
    }
    applyDisplaySettings();
    if (enabled()) start();

    onMessage('listCatches', () => orderSummaries((last?.catches ?? []).map(toCatchSummary)));
    onMessage('rescan', async () => {
      if (isHostDisabled(location.hostname, settings.disabledHosts)) return;
      armed = true;
      if (!observer) start(true);
      else void scan();
      // The popup asks for the list right after this, so answer once the scan has finished.
      if (scanning) await scanning;
    });

    // Settings reach the page within a second (AC-F11.1): the storage change event, not a poll.
    const onStorage = (
      changes: Record<string, { newValue?: unknown } | undefined>,
      area: string,
    ): void => {
      if (area !== 'local') return;
      const change = changes[SETTINGS_STORAGE_KEY];
      if (!change) return;
      const wasEnabled = enabled();
      settings = sanitizeSettings(change.newValue);
      applyDisplaySettings();
      settingsSubs.forEach((cb) => {
        cb();
      });
      const now = enabled();
      if (now && !wasEnabled) start();
      else if (!now && wasEnabled) stop();
    };
    browser.storage.onChanged.addListener(onStorage);

    ctx.onInvalidated(() => {
      observer?.disconnect();
      markers.destroy();
      browser.storage.onChanged.removeListener(onStorage);
      bridge.overlay?.destroy();
      setBridge(undefined);
    });
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      known = new Set();
      bridge.overlay?.dispatch({ kind: 'close' });
      if (enabled()) {
        if (observer) observer.rearm();
        void scan();
      }
    });
  },
});
