// Renders the extension's toolbar and store icons from the Catchline mark (the same drawing as
// site/public/favicon.svg) into src/public/icon/{16,32,48,128}.png. Headless Chromium, one page,
// closed at the end. Run after changing the mark; the PNGs are committed.
//
//   node scripts/make-icons.mjs
//
// 16, 32 and 48 are full bleed. 128 follows the Chrome Web Store rule: 96 x 96 artwork centred
// with 16 px of transparent padding on each side.

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve(import.meta.dirname, '..', 'src', 'public', 'icon');
mkdirSync(OUT, { recursive: true });

const MARK = (px) => `<svg xmlns="http://www.w3.org/2000/svg" width="${String(px)}" height="${String(px)}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#005c86"/>
  <g fill="none" stroke="#f9fcfe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 23C18 23 14 10 22 10"/><rect x="21.5" y="6.5" width="5" height="7" rx="1.2"/>
  </g>
  <circle cx="8" cy="23" r="2.4" fill="#f9fcfe"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [size, art] of [
  [16, 16],
  [32, 32],
  [48, 48],
  [128, 96],
]) {
  const pad = (size - art) / 2;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="padding:${String(pad)}px;width:${String(art)}px;height:${String(art)}px">${MARK(art)}</div></body></html>`,
  );
  await page.screenshot({
    path: join(OUT, `${String(size)}.png`),
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  console.log('saved', `${String(size)}.png`);
}
await browser.close();
