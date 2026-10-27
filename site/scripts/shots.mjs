// Screenshot harness for the landing page and web app (dev tool, not part of the build).
//   node scripts/shots.mjs <outDir> [baseUrl]
// Needs the preview server running (pnpm preview) and Playwright Chromium installed.
// Captures every state the design checklist names: widths 375 / 768 / 1440, light and dark,
// reduced motion, no JavaScript, and the app's empty, success, error and not-found states.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'shots';
const base = process.argv[3] ?? 'http://localhost:4173/';
mkdirSync(out, { recursive: true });

const widths = [
  [375, 812],
  [768, 1024],
  [1440, 900],
];

const browser = await chromium.launch();

async function shoot(
  name,
  url,
  { width, height, scheme = 'light', reduced = false, js = true, fullPage = true, act },
) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    javaScriptEnabled: js,
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(js && !reduced ? 2200 : 400);
  if (act) await act(page);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage });
  if (errors.length) console.log(`${name}: ${errors.join(' | ')}`);
  await ctx.close();
}

for (const [width, height] of widths) {
  await shoot(`landing-${String(width)}`, base, { width, height });
}
await shoot('landing-1440-dark', base, { width: 1440, height: 900, scheme: 'dark' });
await shoot('landing-375-dark', base, { width: 375, height: 812, scheme: 'dark' });
await shoot('landing-1440-reduced', base, {
  width: 1440,
  height: 900,
  reduced: true,
  fullPage: false,
});
await shoot('landing-1440-nojs', base, { width: 1440, height: 900, js: false, fullPage: false });

for (const [width, height] of widths) {
  await shoot(`app-empty-${String(width)}`, `${base}app/`, { width, height });
  await shoot(`app-sample-${String(width)}`, `${base}app/#sample=carrier-specimen`, {
    width,
    height,
    act: async (page) => {
      await page.waitForSelector('.marker');
      await page.locator('.marker').first().click();
      await page.waitForTimeout(1400);
    },
  });
}
await shoot('app-sample-1440-dark', `${base}app/#sample=carrier-specimen`, {
  width: 1440,
  height: 900,
  scheme: 'dark',
  act: async (page) => {
    await page.waitForSelector('.marker');
    await page.locator('.marker').first().click();
    await page.waitForTimeout(1400);
  },
});
await shoot('app-error-375', `${base}app/`, {
  width: 375,
  height: 812,
  act: async (page) => {
    await page.click('#scan');
    await page.waitForTimeout(600);
  },
});
await shoot('app-notfound-375', `${base}app/#sample=not-found`, { width: 375, height: 812 });
await shoot('app-many-375', `${base}app/#sample=many-to-one`, {
  width: 375,
  height: 812,
  fullPage: false,
});

await browser.close();
console.log('done');
