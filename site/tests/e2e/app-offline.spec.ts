// Web app (/app): offline behaviour, installability, the service worker and the network rule.
// Runs at a phone (375 x 812, touch) and at desktop size.
//
// The rule (AC-W10): the pages and the worker request only the site's own static files. No other
// origin, no POST, no fetch/XHR/WebSocket/beacon from page script, and every URL maps to a file
// in the production build.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BUILD_DIR,
  buildFiles,
  expect,
  FIXTURE_DIR,
  ORIGIN,
  press,
  servedFile,
  test,
  waitForResult,
} from './helpers';

const SCRIPT_REQUEST_TYPES = ['fetch', 'xhr', 'websocket', 'eventsource', 'ping'];

test.describe('network rule', () => {
  test('AC-W10: a full session requests only the build’s own static files', async ({
    page,
    context,
  }) => {
    const files = buildFiles();
    const seen: { url: string; method: string; type: string; fromWorker: boolean }[] = [];
    const bad: string[] = [];
    context.on('request', (r) => {
      seen.push({
        url: r.url(),
        method: r.method(),
        type: r.resourceType(),
        fromWorker: r.serviceWorker() !== null,
      });
    });
    context.on('response', (r) => {
      if (r.status() >= 400) bad.push(`${String(r.status())} ${r.url()}`);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/app/');
    await page.fill('#source', readFileSync(join(FIXTURE_DIR, 'retail-specimen.html'), 'utf8'));
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await waitForResult(page);
    await press(page.locator('.marker').first());
    await expect(page.locator('.card')).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      press(page.locator('.card [data-action="image"]')),
    ]);
    expect((await download.path()).length).toBeGreaterThan(0);
    await page.setInputFiles('#file', join(FIXTURE_DIR, 'saas-specimen.html'));
    await expect(page.locator('.result__summary')).toContainText('4 catches');
    await page.goto('/app/#sample=many-to-one');
    await page.reload();
    await expect(page.locator('.catch-row')).toHaveCount(14);

    expect(seen.length).toBeGreaterThan(5);
    for (const r of seen) {
      if (/^(data|blob):/.test(r.url)) continue;
      expect(new URL(r.url).origin, r.url).toBe(ORIGIN);
      expect(r.method, r.url).toBe('GET');
      expect(servedFile(r.url, files), `${r.url} is not a file in the build`).not.toBeNull();
      if (!r.fromWorker) expect(SCRIPT_REQUEST_TYPES, r.url).not.toContain(r.type);
    }
    expect(bad).toEqual([]);
  });

  test('AC-W10: the page is served with a closed Content-Security-Policy', async ({ page }) => {
    const response = await page.goto('/app/');
    expect(response?.status()).toBe(200);
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    // A fetch from page script is blocked by that policy, not just absent from the code.
    const blocked = await page.evaluate(async () => {
      try {
        // eslint-disable-next-line no-restricted-globals -- the probe: the page's own CSP must refuse it
        await fetch('/manifest.webmanifest');
        return false;
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
  });
});

test.describe('offline and installable', () => {
  test('AC-W9: the worker precaches the whole build', async ({ page }) => {
    await page.goto('/app/');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    await expect(page.locator('#offline-note')).toHaveText('Ready to use offline.', {
      timeout: 10_000,
    });
    const cached = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) out.push(new URL(req.url).pathname);
      }
      return out;
    });
    const expected = [...buildFiles()].filter((f) => f !== 'sw.js');
    const missing = expected.filter((f) => !cached.includes(`/${f}`));
    expect(missing).toEqual([]);
  });

  test('AC-W9: with the network off, a reload still scans a sample and opens a card', async ({
    page,
    context,
  }) => {
    await page.goto('/app/');
    await expect(page.locator('#offline-note')).toHaveText('Ready to use offline.', {
      timeout: 10_000,
    });
    await page.reload(); // now controlled by the worker
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await context.setOffline(true);
    for (const [id, count] of [
      ['carrier-specimen', 3],
      ['bank-specimen', 5],
      ['many-to-one', 14],
    ] as const) {
      await page.goto(`/app/#sample=${id}`);
      await page.reload(); // a real offline navigation, answered by the worker
      await expect(page.locator('.catch-row')).toHaveCount(count);
    }
    await press(page.locator('.marker').first());
    await expect(page.locator('.card .chip').first()).toBeVisible();
    // Paste and upload keep working with no network too.
    await page.fill('#source', 'Free shipping on every order*\n\n*Orders of $50+ only.');
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.locator('.catch-row')).toHaveCount(1);
    await page.setInputFiles('#file', join(FIXTURE_DIR, 'travel-specimen.html'));
    await expect(page.locator('.result__summary')).toContainText('3 catches');
    // The landing page is in the cache too.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('AC-W9: the manifest is installable and its icons are real PNGs of the stated size', async ({
    page,
  }) => {
    await page.goto('/app/');
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href ?? '', page.url()).href;
    const res = await page.request.get(manifestUrl);
    expect(res.status()).toBe(200);
    const m = (await res.json()) as {
      start_url: string;
      display: string;
      scope: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(m.display).toBe('standalone');
    expect(new URL(m.start_url, manifestUrl).pathname).toBe('/app/');
    expect(new URL(m.scope, manifestUrl).pathname).toBe('/');
    const wanted = ['192x192', '512x512'];
    for (const size of wanted) {
      const icon = m.icons.find((i) => i.sizes === size && (i.purpose ?? 'any') === 'any');
      expect(icon, `an "any" icon at ${size}`).toBeDefined();
      const r = await page.request.get(new URL(icon?.src ?? '', manifestUrl).href);
      expect(r.status()).toBe(200);
      const png = await r.body();
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(`${String(png.readUInt32BE(16))}x${String(png.readUInt32BE(20))}`).toBe(size);
    }
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  test('AC-W9: the worker is registered at the site root, controls the page, and has a version', async ({
    page,
  }) => {
    await page.goto('/app/');
    await expect(page.locator('#offline-note')).toHaveText('Ready to use offline.', {
      timeout: 10_000,
    });
    const info = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, script: reg.active?.scriptURL ?? '' };
    });
    expect(info.scope).toBe(`${ORIGIN}/`);
    expect(info.script).toBe(`${ORIGIN}/sw.js`);
    const source = readFileSync(join(BUILD_DIR, 'sw.js'), 'utf8');
    expect(source).toMatch(/const VERSION = "[0-9a-f]{12}"/);
    // The worker never goes to the network: its source has no fetch of its own.
    expect(source).not.toMatch(/\bfetch\(/);
  });
});
