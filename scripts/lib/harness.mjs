/* global chrome */
// Shared Playwright harness for the screenshot and demo scripts: a persistent Chromium context with
// the built extension, plus a tiny static server for the synthetic fixtures. Dev tooling only.
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

export const ROOT = resolve(import.meta.dirname, '..', '..');
const EXT = process.env.CATCHLINE_EXT_DIR ?? join(ROOT, '.output', 'chrome-mv3');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'synthetic');

export async function startServer() {
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const file = join(FIXTURES, path.replace(/^\/+/, '').replace(/\.\./g, ''));
    if (!path.endsWith('.html') || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

/** `extraArgs` are added to Chromium's command line (launch-assets maps a fictional host). */
export async function launch(extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'catchline-shots-'));
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless: process.env.HEADED ? false : true,
    args: [
      ...extraArgs,
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
    ],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  return {
    context,
    worker,
    extensionId,
    async close() {
      await context.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function tabIdOf(worker, prefix) {
  return worker.evaluate(async (p) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url?.startsWith(p))?.id ?? null;
  }, prefix);
}
