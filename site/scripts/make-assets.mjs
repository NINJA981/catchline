// Generates the PNG assets in public/: PWA icons and the Open Graph card.
//   pnpm build && pnpm preview   (in another terminal), then  node scripts/make-assets.mjs [baseUrl]
// The OG card is the real "Save image" output of the web app for the carrier specimen, so it is
// exactly what the share-this-catch feature produces (no mock-up).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4619/';
const pub = new URL('../public/', import.meta.url);
mkdirSync(new URL('icons/', pub), { recursive: true });

const PRUSSIAN = '#005c86';
const ON = '#f9fcfe';

const mark = (scale) => `
  <g transform="translate(16 16) scale(${scale}) translate(-16 -16)" fill="none" stroke="${ON}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 23C18 23 14 10 22 10"/><rect x="21.5" y="6.5" width="5" height="7" rx="1.2"/>
    <circle cx="8" cy="23" r="2.4" fill="${ON}" stroke="none"/>
  </g>`;

const svg = (size, { rounded, scale }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
    <rect width="32" height="32" ${rounded ? 'rx="6"' : ''} fill="${PRUSSIAN}"/>${mark(scale)}</svg>`;

const browser = await chromium.launch();

async function png(markup, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${markup}</body>`);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  writeFileSync(new URL(file, pub), buf);
  await page.close();
}

await png(svg(192, { rounded: true, scale: 1 }), 192, 'icons/icon-192.png');
await png(svg(512, { rounded: true, scale: 1 }), 512, 'icons/icon-512.png');
// Maskable: full bleed, mark inside the 80% safe zone.
await png(svg(512, { rounded: false, scale: 0.7 }), 512, 'icons/icon-maskable-512.png');
await png(svg(180, { rounded: false, scale: 0.8 }), 180, 'icons/apple-touch-icon.png');

// Open Graph card: the app's own share image for the carrier specimen.
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  acceptDownloads: true,
  serviceWorkers: 'block',
});
const page = await ctx.newPage();
await page.goto(`${base}app/#sample=carrier-specimen`);
await page.waitForSelector('.marker');
await page.locator('.marker').first().click();
await page.waitForSelector('.card [data-action="image"]');
await page.waitForTimeout(1300);
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('.card [data-action="image"]'),
]);
await download.saveAs(fileURLToPath(new URL('og.png', pub)));
await browser.close();
console.log('assets written to public/');
