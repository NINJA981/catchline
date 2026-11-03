/* global chrome */
// Launch images from the REAL built extension (Chrome, .output/chrome-mv3) on a fictional page:
// store screenshots (1280 x 800), the GitHub social preview (1280 x 640) and the README hero GIF.
// Run `pnpm build` first. One browser, closed at the end. Dev tooling only; nothing here ships.
//
//   node scripts/launch-assets.mjs            (writes docs/launch/*.png and docs/launch/hero.gif)
//
// The host page is tests/fixtures/synthetic/carrier-specimen.html ("Ridgeline Mobile", a fictional
// carrier) with a stylesheet injected for the capture, so it reads like a promo page instead of a
// browser-default document. The card, tether, chips, Show all and popup are the extension's own.
// The GIF needs ffmpeg on PATH; without it the GIF is skipped and the PNGs are still written.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { launch, ROOT, startServer, tabIdOf } from './lib/harness.mjs';

const OUT = join(ROOT, 'docs', 'launch');
mkdirSync(OUT, { recursive: true });

const HOST_CSS = `
  html { background: #f4f1ea !important; }
  body { margin: 0 !important; color: #1d232b !important;
    font: 17px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif !important; }
  .site-header { display: flex; align-items: center; padding: 0 48px; background: #12202f;
    position: static !important; }
  .site-header a { color: #fff !important; text-decoration: none; margin-right: 28px; font-size: 15px; }
  .site-header a:first-child { font-weight: 700; font-size: 18px; margin-right: 48px; }
  main { max-width: 1040px; margin: 0 auto; padding: 0 48px; }
  .hero { padding: 40px 0 28px; }
  .hero h1 { font-size: 44px; line-height: 1.1; margin: 0 0 16px; letter-spacing: -0.02em; }
  .hero-price { font-size: 76px; font-weight: 800; line-height: 1; margin: 0 0 18px;
    letter-spacing: -0.03em; color: #12202f; }
  .hero-sub { font-size: 20px; margin: 6px 0; }
  .cta { display: inline-block; margin-top: 18px; padding: 12px 26px; border-radius: 999px;
    background: #d9482b; color: #fff !important; font-weight: 700; text-decoration: none; }
  .plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 8px 0 0; }
  .plan { background: #fff; border-radius: 10px; padding: 14px 18px; }
  .plan h2 { font-size: 18px; margin: 0 0 4px; }
  .plan p { margin: 0; font-size: 14px; color: #4a5560; }
  .faq { display: none; }
  .legal-footer { max-width: 1040px; margin: 20px auto 0; padding: 0 48px 24px; color: #6b7480; }
  .legal-footer p { margin: 2px 0; }
`;

const srv = await startServer();
const h = await launch();
const { context, worker, extensionId } = h;

async function openSpecimen(w, ht) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: ht });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto(`${srv.origin}/carrier-specimen.html`);
  await page.addStyleTag({ content: HOST_CSS });
  await page.waitForFunction(
    () => document.querySelector('catchline-markers')?.shadowRoot?.querySelector('button'),
    null,
    { timeout: 8000 },
  );
  await page.waitForTimeout(600);
  return page;
}

/** The background's open request: dispatch, injecting the overlay script first when needed. */
async function openOverlay(page, req) {
  const tabId = await tabIdOf(worker, page.url());
  await worker.evaluate(
    async ([id, r]) => {
      const run = () =>
        chrome.scripting.executeScript({
          target: { tabId: id, frameIds: [0] },
          func: (q) => {
            const b = globalThis[Symbol.for('catchline.bridge')];
            if (!b) return null;
            if (b.overlay) {
              b.overlay.dispatch(q);
              return true;
            }
            b.pending = q;
            return false;
          },
          args: [r],
        });
      const [first] = await run();
      if (first?.result === false) {
        await chrome.scripting.executeScript({
          target: { tabId: id, frameIds: [0] },
          files: ['/content-scripts/overlay.js'],
        });
      }
    },
    [tabId, req],
  );
  await page.bringToFront();
}

const waitOverlay = (page, sel) =>
  page.waitForFunction(
    (s) => document.querySelector('catchline-overlay')?.shadowRoot?.querySelector(s),
    sel,
    { timeout: 8000 },
  );

async function firstMarkerId(page) {
  const tabId = await tabIdOf(worker, page.url());
  return worker.evaluate(async (id) => {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: id, frameIds: [0] },
      func: () =>
        globalThis[Symbol.for('catchline.bridge')].getAnalysis().catches[0].marker.id,
    });
    return r.result;
  }, tabId);
}

const seek = (page, t) =>
  page.evaluate((ms) => {
    for (const a of document.querySelector('catchline-overlay').shadowRoot.getAnimations()) {
      a.pause();
      a.currentTime = ms;
    }
  }, t);

const save = async (page, name, opts = {}) => {
  await page.screenshot({ path: join(OUT, name), animations: 'allow', timeout: 20000, ...opts });
  console.log('saved', name);
};

// 1. Hero GIF frames and store screenshot 1: the signature moment on the $0/mo* claim.
const frames = mkdtempSync(join(tmpdir(), 'catchline-gif-'));
let n = 0;
const frame = async (page) => {
  n += 1;
  await page.screenshot({ path: join(frames, `f${String(n).padStart(3, '0')}.png`) });
};
{
  const page = await openSpecimen(1280, 800);
  await frame(page);
  const rest = join(frames, 'f001.png');
  for (let i = 0; i < 14; i++) {
    n += 1;
    copyFileSync(rest, join(frames, `f${String(n).padStart(3, '0')}.png`));
  }
  await openOverlay(page, { kind: 'card', id: await firstMarkerId(page) });
  await waitOverlay(page, '.cl-card');
  for (let t = 0; t <= 1200; t += 50) {
    await seek(page, t);
    await page.waitForTimeout(60);
    await frame(page);
  }
  await seek(page, 5000);
  await page.waitForTimeout(150);
  await save(page, 'store-1-card.png');
  const last = join(frames, `f${String(n).padStart(3, '0')}.png`);
  for (let i = 0; i < 40; i++) {
    n += 1;
    copyFileSync(last, join(frames, `f${String(n).padStart(3, '0')}.png`));
  }

  // 2. Show all: every claim tethered to a rail of cards.
  await openOverlay(page, { kind: 'show-all' });
  await waitOverlay(page, '.cl-rail');
  await page.waitForTimeout(900);
  await save(page, 'store-2-show-all.png');
  await page.close();
}

// 3. The popup ledger for the same page, shown over it where the toolbar popup opens.
{
  const page = await openSpecimen(1280, 800);
  const tabId = await tabIdOf(worker, srv.origin);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 380, height: 640 });
  await popup.emulateMedia({ colorScheme: 'light' });
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
  await popup.waitForTimeout(900);
  const box = await popup.locator('main.pop').boundingBox();
  const popupPng = await popup.screenshot({ clip: box });
  await popup.close();
  await page.bringToFront();
  await page.evaluate(
    ([src, w]) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.style.cssText = `position:fixed;top:12px;right:24px;width:${String(w)}px;z-index:2147483647;border-radius:8px;box-shadow:0 12px 40px rgba(18,32,47,.28),0 0 0 1px rgba(18,32,47,.12)`;
      document.body.appendChild(img);
      return new Promise((ok) => {
        img.onload = ok;
      });
    },
    [`data:image/png;base64,${popupPng.toString('base64')}`, box.width],
  );
  await page.waitForTimeout(200);
  await save(page, 'store-3-popup.png');
  await page.close();
}

// 4. GitHub social preview, 1280 x 640: the name, the line, and the real card screenshot.
{
  const font = (p) => readFileSync(join(ROOT, 'site', 'public', 'fonts', p)).toString('base64');
  const card = readFileSync(join(OUT, 'store-1-card.png')).toString('base64');
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: S; src: url(data:font/woff2;base64,${font('schibsted-grotesk-latin.woff2')}) format("woff2"); font-weight: 400 900; }
    html,body { margin:0; width:1280px; height:640px; overflow:hidden; background:oklch(0.99 0.003 240); font-family:S, sans-serif; color:oklch(0.22 0.02 245); }
    .l { position:absolute; left:72px; top:0; bottom:0; width:470px; display:flex; flex-direction:column; justify-content:center; }
    .n { font-size:30px; font-weight:600; color:oklch(0.45 0.1 238); margin:0 0 20px; letter-spacing:-.01em; }
    h1 { font-size:72px; line-height:.95; font-weight:600; letter-spacing:-.035em; margin:0 0 28px; }
    p { font-size:22px; line-height:1.4; margin:0; color:oklch(0.4 0.02 245); }
    .shot { position:absolute; left:600px; top:64px; width:820px; border-radius:12px; overflow:hidden; box-shadow:0 20px 60px rgba(18,32,47,.22), 0 0 0 1px rgba(18,32,47,.1); }
    .shot img { display:block; width:820px; }
  </style></head><body>
    <div class="l"><div class="n">Catchline</div><h1>The catch, next to the claim.</h1>
    <p>Matches every *, &dagger; and &sup1; to its footnote and lists the fees beside the promise. Runs in your browser. No network.</p></div>
    <div class="shot"><img src="data:image/png;base64,${card}" alt=""></div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await save(page, 'social-preview.png');
  await page.close();
}

await h.close();
srv.close();

// 5. Hero GIF: 960 px wide, 20 fps, one palette for the whole clip.
try {
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    '20',
    '-i',
    join(frames, 'f%03d.png').split(sep).join('/'),
    '-vf',
    'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    '-loop',
    '0',
    join(OUT, 'hero.gif'),
  ]);
  console.log('saved hero.gif', n, 'frames');
} catch (e) {
  console.log('hero.gif skipped:', String(e.message).split('\n')[0]);
}
rmSync(frames, { recursive: true, force: true });
