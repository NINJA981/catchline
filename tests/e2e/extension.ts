// Playwright fixtures: a persistent Chromium context with the built extension loaded, and a tiny
// local HTTP server that serves the synthetic fixtures (content scripts do not run on file://).
// Build first: `pnpm build` (the test:e2e script does).

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '..', '..');
const EXTENSION_PATH = join(ROOT, '.output', 'chrome-mv3');
const FIXTURE_DIR = join(ROOT, 'tests', 'fixtures', 'synthetic');

const FILLER =
  '<p style="margin:24px 0">Filler paragraph so the page is tall enough to scroll.</p>'.repeat(60);

/** Pages served from memory for tests that need timing or navigation the static fixtures lack. */
const DYNAMIC_PAGES: Record<string, string> = {
  // The legal drawer is inserted 1.5 s after load (AC-F2.5).
  '/lazy-legal.html': `<!doctype html><html lang="en"><body style="font-size:16px">
    <main><p>Free shipping on every order†</p></main>
    <footer id="legal" style="font-size:12px"></footer>
    <script>
      setTimeout(() => {
        const p = document.createElement('p');
        p.textContent = '† Orders of $50+ only. Contiguous US only. While supplies last.';
        document.getElementById('legal').appendChild(p);
      }, 1500);
    </script></body></html>`,
};

// Extra dynamic pages for the overlay tests (AC-F5, AC-F6).
DYNAMIC_PAGES['/tall.html'] =
  `<!doctype html><html lang="en"><body style="margin:0;font:16px/1.5 Georgia,serif">
  <header id="sticky" style="position:sticky;top:0;height:64px;background:#fff;border-bottom:1px solid #ccc;z-index:10;padding:20px 16px;box-sizing:border-box">Sticky header</header>
  <main style="padding:0 16px">
    ${FILLER}
    <h1 id="claim" style="margin:0 0 24px">Unlimited data for $25/mo*</h1>
    <p><input id="host-input" type="text" aria-label="Search" placeholder="Search the page"></p>
    ${FILLER}
  </main>
  <footer style="font-size:11px;padding:16px">*Requires autopay and a new line. $35 activation fee. 24-month agreement.</footer>
</body></html>`;
DYNAMIC_PAGES['/hostile.html'] =
  `<!doctype html><html lang="en"><head><style>* { color: red !important; font-size: 30px !important; font-family: monospace !important; letter-spacing: 5px !important }</style></head><body>
  <h1>Free shipping on every order*</h1>
  <footer>*Orders of $50+ only. Contiguous US only. While supplies last.</footer>
</body></html>`;

export interface Site {
  origin: string;
  url: (name: string) => string;
}

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
  site: Site;
  /** Every request any page or the service worker made, as URLs. */
  requests: string[];
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  site: async ({}, use) => {
    const server: Server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      const dynamic = DYNAMIC_PAGES[path];
      if (dynamic) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(dynamic);
        return;
      }
      const file = join(FIXTURE_DIR, path.replace(/^\/+/, '').replace(/\.\./g, ''));
      if (!path.endsWith('.html') || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(file));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const { port } = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${String(port)}`;
    await use({ origin, url: (name) => `${origin}/${name}` });
    server.closeAllConnections(); // keep-alive sockets would hold close() open
    await new Promise<void>((ok) => {
      server.close(() => {
        ok();
      });
    });
  },

  requests: async ({ context }, use) => {
    const urls: string[] = [];
    context.on('request', (r) => {
      // Loads an extension page makes of its own packaged files are not network requests.
      try {
        if (r.frame().url().startsWith('chrome-extension://')) return;
      } catch {
        // Service worker requests have no frame.
      }
      urls.push(r.url());
    });
    await use(urls);
  },

  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    if (!existsSync(join(EXTENSION_PATH, 'manifest.json'))) {
      throw new Error('Extension not built. Run "pnpm build" before the e2e tests.');
    }
    const userDataDir = mkdtempSync(join(tmpdir(), 'catchline-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium', // new headless mode: the only headless mode that loads extensions
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
      ],
    });
    await use(context);
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  },

  worker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    await use(existing ?? (await context.waitForEvent('serviceworker')));
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

export { expect } from '@playwright/test';

/** The tab id Chromium gave the page whose URL starts with `prefix`. */
export async function tabIdOf(worker: Worker, prefix: string): Promise<number> {
  const id = await worker.evaluate(async (p) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url?.startsWith(p))?.id ?? null;
  }, prefix);
  if (id === null) throw new Error(`No tab for ${prefix}`);
  return id;
}

export interface BadgeState {
  text: string;
  title: string;
}

export async function badgeOf(worker: Worker, tabId: number): Promise<BadgeState> {
  return worker.evaluate(async (id) => {
    const [text, title] = await Promise.all([
      chrome.action.getBadgeText({ tabId: id }),
      chrome.action.getTitle({ tabId: id }),
    ]);
    return { text, title };
  }, tabId);
}

/** Polls until the badge matches, so tests do not depend on scan timing. */
export async function waitForBadge(
  worker: Worker,
  tabId: number,
  predicate: (b: BadgeState) => boolean,
  timeoutMs = 15000,
): Promise<BadgeState> {
  const deadline = Date.now() + timeoutMs;
  let last: BadgeState = { text: '', title: '' };
  while (Date.now() < deadline) {
    last = await badgeOf(worker, tabId);
    if (predicate(last)) return last;
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error(`Badge never matched. Last state: ${JSON.stringify(last)}`);
}

export async function openPage(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

/** Waits for the scanner to draw its hit targets, then returns the first marker button. */
export async function waitForMarkers(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('catchline-markers')?.shadowRoot?.querySelector('button.m'),
    null,
    { timeout: 8000 },
  );
}

/** Clicks the nth marker hit target through the page, like a user would. */
export async function openCard(page: Page, index = 0): Promise<void> {
  await waitForMarkers(page);
  await page.evaluate((i) => {
    const b = document.querySelector('catchline-markers')?.shadowRoot?.querySelectorAll('button.m')[
      i
    ];
    (b as HTMLElement | undefined)?.click();
  }, index);
  await page.waitForFunction(
    () => document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card'),
    null,
    { timeout: 8000 },
  );
  await page.bringToFront();
}
