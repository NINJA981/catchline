// Parity: the web app (site/, built to .output/site) and the extension must produce identical
// engine output on the same page. Each synthetic fixture is opened in Chromium with the extension
// loaded (real layout, computed styles) and pasted into the web app (a parsed document with no
// layout). Compared:
//   - the catch list: marker id, claim text, first three chip labels, in order
//   - whether a footnote was found for each catch
//   - the rollup headline (badge tooltip vs the app headline) and the ledger rows (popup vs app)
//
// Needs both builds: `pnpm build` and `pnpm --dir site build` (the test:e2e script does both).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { badgeOf, expect, openPage, tabIdOf, test } from './extension';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SITE_DIR = join(ROOT, '.output', 'site');
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'synthetic');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.txt': 'text/plain',
};

function serveSite(): Promise<{ server: Server; origin: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
      let file = join(SITE_DIR, path);
      if (!file.startsWith(SITE_DIR)) file = SITE_DIR;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      ok({ server, origin: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}` });
    });
  });
}

interface Row {
  id: string;
  claim: string;
  chips: string;
  matched: boolean;
}

/** What the extension's content script reports for the tab, once the scan has stopped changing. */
async function extensionRows(
  worker: import('@playwright/test').Worker,
  tabId: number,
): Promise<Row[]> {
  const read = (): Promise<string> =>
    worker.evaluate(async (id) => {
      try {
        const list: unknown = await chrome.tabs.sendMessage(
          id,
          { catchline: 'listCatches', args: [] },
          { frameId: 0 },
        );
        return JSON.stringify(list ?? []);
      } catch {
        return '[]';
      }
    }, tabId);
  let last = '';
  let stable = 0;
  const started = Date.now();
  while (Date.now() - started < 12000) {
    const now = await read();
    stable = now === last ? stable + 1 : 0;
    last = now;
    // Stable for a second and a half. Pages with nothing to find settle the same way.
    if (stable >= 6) break;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  const list = JSON.parse(last) as {
    id: string;
    claimText: string;
    chipLabels: string[];
    matched: boolean;
  }[];
  return list.map((c) => ({
    id: c.id,
    claim: c.claimText,
    chips: c.chipLabels.join(', '),
    matched: c.matched,
  }));
}

async function appRows(app: Page): Promise<{ rows: Row[]; headline: string; ledger: string[] }> {
  const rows = await app.locator('.catch-row').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-catch') ?? '',
      claim: el.querySelector('.catch-row__claim')?.textContent ?? '',
      second: el.querySelector('.catch-row__chips')?.textContent ?? '',
    })),
  );
  const headline =
    (await app
      .locator('.result__summary')
      .first()
      .textContent({ timeout: 500 })
      .catch(() => '')) ?? '';
  const ledger = await app.locator('.ledger__row dd').allTextContents();
  const NO_TERMS = [
    'No footnote found',
    'Terms are on another page',
    'Reference footnote',
    'No terms found',
  ];
  return {
    rows: rows.map((r) => ({
      id: r.id,
      claim: r.claim,
      // The app shows a sentence in place of chips when there are none.
      chips: NO_TERMS.includes(r.second) ? '' : r.second,
      matched: r.second !== 'No footnote found' && r.second !== 'Terms are on another page',
    })),
    headline: headline.replace(/\s+/g, ' ').trim(),
    ledger: ledger.map((t) => t.replace(/\s+/g, ' ').trim()),
  };
}

const FIXTURES = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.html'))
  .sort();

test.describe('web app and extension agree (same engine, same output)', () => {
  test.beforeAll(() => {
    if (!existsSync(join(SITE_DIR, 'app', 'index.html'))) {
      throw new Error('Site not built. Run "pnpm --dir site build" before the parity test.');
    }
  });

  for (const name of FIXTURES) {
    test(`${name}: identical catches, chips, footnote matches and rollup`, async ({
      context,
      extensionId,
      worker,
      site,
    }) => {
      const { server, origin } = await serveSite();
      try {
        // Extension side.
        const url = site.url(name);
        const page = await openPage(context, url);
        const tabId = await tabIdOf(worker, url);
        const ext = await extensionRows(worker, tabId);
        const badge = await badgeOf(worker, tabId);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
        const popupLedger =
          ext.length > 0
            ? await popup
                .locator('.pop-lrow dd')
                .allTextContents()
                .then((l) => l.map((t) => t.replace(/\s+/g, ' ').trim()))
            : [];
        await popup.close();
        await page.close();

        // Web app side: the same file, pasted.
        const app = await context.newPage();
        await app.goto(`${origin}/app/`);
        await app.fill('#source', readFileSync(join(FIXTURE_DIR, name), 'utf8'));
        await app.getByRole('button', { name: 'Find the catches' }).click();
        await expect(app.locator('#result .result__summary, #result .panel')).toBeVisible();
        const web = await appRows(app);

        // Guard against a vacuous pass: the specimens all have catches to compare.
        if (name.endsWith('-specimen.html') || name === 'many-to-one.html') {
          expect(ext.length, 'the extension found catches on a specimen').toBeGreaterThan(2);
        }
        expect(
          web.rows.map((r) => r.id),
          'marker ids',
        ).toEqual(ext.map((r) => r.id));
        expect(
          web.rows.map((r) => r.claim),
          'claim text',
        ).toEqual(ext.map((r) => r.claim));
        // The extension reports chips only; the app falls back to a sentence. Compare chips where
        // the extension has any, and the found/not-found state everywhere.
        expect(
          web.rows.map((r) => r.chips),
          'chip labels',
        ).toEqual(ext.map((r) => r.chips));
        expect(
          web.rows.map((r) => r.matched || r.chips !== ''),
          'footnote found',
        ).toEqual(ext.map((r) => r.matched || r.chips !== ''));

        // Rollup. The badge tooltip reads "N catches: ..." when anything counts.
        const counted = badge.title.match(/^(\d+) catch/);
        if (counted) {
          expect(web.headline, 'headline').toBe(badge.title.replace(/^Catchline: /, ''));
          // The popup is compact and shows at most the first 8 ledger rows; the app shows them all.
          expect(web.ledger.slice(0, 8), 'ledger rows').toEqual(popupLedger);
        } else {
          expect(web.headline, 'headline when nothing counts').not.toMatch(/^\d+ catch/);
        }
        await app.close();
      } finally {
        server.closeAllConnections();
        server.close();
      }
    });
  }

  test('the fixture set is not empty and includes every sample the app bundles', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(12);
    for (const id of [
      'carrier-specimen',
      'bank-specimen',
      'retail-specimen',
      'streaming-specimen',
      'saas-specimen',
      'travel-specimen',
      'many-to-one',
      'not-found',
    ]) {
      expect(FIXTURES).toContain(`${id}.html`);
    }
  });
});
