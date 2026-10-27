// AC-F10.3 (persists across browser restart) and AC-F11.1 (settings survive and reach content).
// Each test closes the browser and starts a new one on the same profile directory.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext, Worker } from '@playwright/test';
import { expect, launchExtension, test, waitForMarkers } from './extension';

async function workerOf(context: BrowserContext): Promise<Worker> {
  const [existing] = context.serviceWorkers();
  return existing ?? context.waitForEvent('serviceworker');
}

test.describe('settings survive a browser restart', () => {
  test('AC-F10.3: a site switched off stays off after a restart, and Options lists it', async ({
    site,
  }) => {
    const profile = mkdtempSync(join(tmpdir(), 'catchline-restart-'));
    try {
      // First run: scan, then switch the site off from the popup.
      let context = await launchExtension(profile);
      let worker = await workerOf(context);
      let extensionId = new URL(worker.url()).host;
      const page = await context.newPage();
      await page.goto(site.url('carrier-specimen.html'));
      await waitForMarkers(page);
      const tabId = await worker.evaluate(
        async () => (await chrome.tabs.query({})).find((t) => t.url?.startsWith('http'))?.id ?? -1,
      );
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
      await popup.getByRole('switch', { name: /Catchline on 127\.0\.0\.1/ }).click();
      await expect(popup.getByText(/Catchline is off on 127\.0\.0\.1/)).toBeVisible();
      await context.close();

      // Second run, same profile: nothing is scanned and the choice is still there.
      context = await launchExtension(profile);
      worker = await workerOf(context);
      extensionId = new URL(worker.url()).host;
      const stored = await worker.evaluate(async () => {
        const r = await chrome.storage.local.get('settings');
        return r.settings as { disabledHosts?: string[] } | undefined;
      });
      expect(stored?.disabledHosts).toContain('127.0.0.1');
      const again = await context.newPage();
      await again.goto(site.url('carrier-specimen.html'));
      await again.waitForTimeout(2000);
      const markerButtons = await again.evaluate(
        () =>
          document.querySelector('catchline-markers')?.shadowRoot?.querySelectorAll('button.m')
            .length ?? 0,
      );
      expect(markerButtons).toBe(0);
      const badge = await worker.evaluate(async () => {
        const tab = (await chrome.tabs.query({})).find((t) => t.url?.startsWith('http'));
        return chrome.action.getBadgeText({ tabId: tab?.id ?? -1 });
      });
      expect(badge).toBe('');
      const options = await context.newPage();
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(options.getByText('127.0.0.1').first()).toBeVisible();
      await context.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });

  test('AC-F11.1: every setting written in one run is read back in the next', async () => {
    const profile = mkdtempSync(join(tmpdir(), 'catchline-restart-'));
    try {
      let context = await launchExtension(profile);
      let worker = await workerOf(context);
      const extensionId = new URL(worker.url()).host;
      const options = await context.newPage();
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      const toggles = options.getByRole('switch');
      const before = await toggles.evaluateAll((els) =>
        els.map((e) => e.getAttribute('aria-checked')),
      );
      expect(before.length).toBeGreaterThan(1);
      // Flip every switch on the page, wait for the save to settle, remember what it says.
      for (let i = 0; i < before.length; i++) await toggles.nth(i).click();
      await options.waitForTimeout(600);
      const after = await toggles.evaluateAll((els) =>
        els.map((e) => e.getAttribute('aria-checked')),
      );
      expect(after).not.toEqual(before);
      await context.close();

      context = await launchExtension(profile);
      worker = await workerOf(context);
      const reopened = await context.newPage();
      await reopened.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
      await expect(reopened.getByRole('switch').first()).toBeVisible();
      const restored = await reopened
        .getByRole('switch')
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
      expect(restored).toEqual(after);
      await context.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });
});
