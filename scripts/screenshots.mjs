/* global chrome */
// Visual QA captures (DESIGN_BIBLE section 9.1): the built extension in real Chromium, at 375, 768
// and 1440 px, light and dark, saved to docs/screenshots/. Run `pnpm build` first.
//
//   node scripts/screenshots.mjs [overlay|popup|states|pages|strip|all]
//
// Frame strips pause every Web Animation in the overlay's shadow root and seek it, the same way the
// demo capture will (DESIGN.md "Capture"). Dev tooling only; nothing here ships in the extension.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { launch, ROOT, startServer, tabIdOf } from './lib/harness.mjs';

const OUT = join(ROOT, 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });
const WIDTHS = [
  [375, 812],
  [768, 900],
  [1440, 900],
];
const SCHEMES = ['light', 'dark'];
const which = process.argv[2] ?? 'all';
const want = (n) => which === 'all' || which === n;

const srv = await startServer();
const h = await launch();
const { context, worker, extensionId } = h;

async function setSettings(patch) {
  await worker.evaluate(
    (p) =>
      chrome.storage.local
        .get('settings')
        .then((s) =>
          chrome.storage.local.set({ settings: { version: 1, ...(s.settings ?? {}), ...p } }),
        ),
    patch,
  );
}

async function openFixture(name, w, ht, scheme, reduced = false) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: ht });
  await page.emulateMedia({
    colorScheme: scheme,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await page.goto(`${srv.origin}/${name}`);
  await page
    .waitForFunction(
      () => document.querySelector('catchline-markers')?.shadowRoot?.querySelector('button'),
      null,
      {
        timeout: 6000,
      },
    )
    .catch(() => undefined);
  await page.waitForTimeout(500);
  return page;
}

/** What the background does for a request: dispatch, injecting the overlay first when needed. */
async function openOverlay(page, req) {
  const tabId = await tabIdOf(worker, page.url());
  await worker.evaluate(
    async ([id, r]) => {
      const run = () =>
        chrome.scripting.executeScript({
          target: { tabId: id, frameIds: [0] },
          func: (req) => {
            const b = globalThis[Symbol.for('catchline.bridge')];
            if (!b) return null;
            if (b.overlay) {
              b.overlay.dispatch(req);
              return true;
            }
            b.pending = req;
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
    {
      timeout: 8000,
    },
  );

const settle = async (page) => {
  await page.evaluate(() =>
    document
      .querySelector('catchline-overlay')
      ?.shadowRoot?.getAnimations()
      .forEach((a) => a.finish()),
  );
  await page.waitForTimeout(200);
};

const shot = async (page, name, opts = {}) => {
  await page.screenshot({
    path: join(OUT, `${name}.png`),
    animations: 'allow',
    timeout: 20000,
    ...opts,
  });
  console.log('saved', name);
};

async function markerIdAt(page, i) {
  // The hit-target buttons carry no id; ask the bridge through the isolated world.
  const tabId = await tabIdOf(worker, page.url());
  const ids = await worker.evaluate(async (id) => {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: id, frameIds: [0] },
      func: () =>
        globalThis[Symbol.for('catchline.bridge')].getAnalysis().catches.map((c) => c.marker.id),
    });
    return r.result;
  }, tabId);
  return ids[i];
}
const firstMarkerId = (page) => markerIdAt(page, 0);

if (want('overlay')) {
  for (const scheme of SCHEMES) {
    for (const [w, ht] of WIDTHS) {
      const page = await openFixture('carrier-specimen.html', w, ht, scheme);
      await openOverlay(page, { kind: 'card', id: await firstMarkerId(page) });
      await waitOverlay(page, '.cl-card');
      await settle(page);
      await shot(page, `overlay-card-${String(w)}-${scheme}`);
      await openOverlay(page, { kind: 'show-all' });
      await waitOverlay(page, '.cl-rail');
      await page.waitForTimeout(600);
      await shot(page, `overlay-showall-${String(w)}-${scheme}`);
      await page.keyboard.press('j');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await shot(page, `overlay-showall-expanded-${String(w)}-${scheme}`);
      await page.close();
    }
  }
  // Card states at 1440, light and dark.
  for (const scheme of SCHEMES) {
    for (const [fixture, tag, index] of [
      ['many-to-one.html', 'many-to-one', 0],
      ['not-found.html', 'not-found', 0],
    ]) {
      const page = await openFixture(fixture, 1440, 900, scheme);
      await openOverlay(page, { kind: 'card', id: await markerIdAt(page, index) });
      await waitOverlay(page, '.cl-card');
      await page.waitForTimeout(2300);
      await settle(page);
      await shot(page, `overlay-state-${tag}-${scheme}`);
      await page.close();
    }
  }
}

if (want('strip')) {
  for (const reduced of [false, true]) {
    const page = await openFixture('carrier-specimen.html', 1440, 800, 'light', reduced);
    await openOverlay(page, { kind: 'card', id: await firstMarkerId(page) });
    await waitOverlay(page, '.cl-card');
    const dir = join(OUT, reduced ? 'strip-reduced' : 'strip-flight');
    mkdirSync(dir, { recursive: true });
    const times = reduced
      ? [0, 30, 60, 90, 120, 150, 200, 300, 400, 500]
      : [0, 60, 120, 200, 300, 400, 520, 600, 680, 760, 840, 960, 1100];
    let i = 0;
    for (const T of times) {
      await page.evaluate((t) => {
        document
          .querySelector('catchline-overlay')
          .shadowRoot.getAnimations()
          .forEach((a) => {
            a.pause();
            a.currentTime = t;
          });
      }, T);
      await page.waitForTimeout(90);
      await page.screenshot({
        path: join(dir, `f${String(i).padStart(2, '0')}-${String(T)}ms.png`),
        clip: { x: 0, y: 80, width: 900, height: 520 },
        animations: 'allow',
        timeout: 20000,
      });
      i++;
    }
    console.log('strip', reduced ? 'reduced' : 'flight', i, 'frames');
    await page.close();
    try {
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .sort();
      // Contact sheet: 4 columns of 450 px frames. ffmpeg's glob input is not available on Windows,
      // so the frames are copied to numbered names first.
      const tmp = mkdtempSync(join(tmpdir(), 'catchline-strip-'));
      files.forEach((f, n) => {
        copyFileSync(join(dir, f), join(tmp, `n${String(n + 1).padStart(3, '0')}.png`));
      });
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        '1',
        '-i',
        join(tmp, 'n%03d.png').split(sep).join('/'),
        '-vf',
        `scale=450:-1,tile=4x${String(Math.ceil(files.length / 4))}`,
        '-frames:v',
        '1',
        join(OUT, reduced ? 'strip-reduced-motion.png' : 'strip-flight.png'),
      ]);
      rmSync(tmp, { recursive: true, force: true });
    } catch (e) {
      console.log('contact sheet skipped:', String(e.message).split('\n')[0]);
    }
  }
}

if (want('popup')) {
  const popupAt = async (tabId, scheme, init) => {
    const p = await context.newPage();
    await p.setViewportSize({ width: 380, height: 640 });
    await p.emulateMedia({ colorScheme: scheme });
    if (init) await p.addInitScript(init);
    await p.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
    return p;
  };
  const capture = async (name, fixture, scheme, init, wait = 700) => {
    const tab = await context.newPage();
    await tab.goto(fixture ? `${srv.origin}/${fixture}` : 'about:blank');
    await tab.waitForTimeout(1200);
    const id = await tabIdOf(worker, fixture ? srv.origin : 'about:blank');
    const p = await popupAt(id, scheme, init);
    await p.waitForTimeout(wait);
    await shot(p, `popup-${name}-${scheme}`, { clip: await p.locator('main.pop').boundingBox() });
    await p.close();
    await tab.close();
  };
  for (const scheme of SCHEMES) {
    await capture('success', 'carrier-specimen.html', scheme);
    await capture('success-bank', 'bank-specimen.html', scheme);
    await capture('reference-only', 'reference-footnotes.html', scheme);
    await capture('empty', 'cents.html', scheme);
    await capture('restricted', null, scheme);
    await capture(
      'loading',
      'carrier-specimen.html',
      scheme,
      () => {
        const orig = chrome.storage.session.get.bind(chrome.storage.session);
        chrome.storage.session.get = (...a) =>
          new Promise((ok) => setTimeout(() => ok(orig(...a)), 4000));
      },
      500,
    );
    await capture('error', 'carrier-specimen.html', scheme, () => {
      chrome.tabs.sendMessage = () => Promise.reject(new Error('no receiver'));
    });
    await capture('permission', 'carrier-specimen.html', scheme, () => {
      chrome.permissions.contains = () => Promise.resolve(false);
    });
    await setSettings({ disabledHosts: ['127.0.0.1'] });
    await capture('disabled', 'carrier-specimen.html', scheme);
    await setSettings({ disabledHosts: [] });
  }
}

if (want('states')) {
  // State sheet (bible 9.1 item 2): rest, hover, focus-visible, pressed and disabled on the popup's
  // controls, one sheet per theme. Real input events, so :hover, :focus-visible and :active are real.
  for (const scheme of SCHEMES) {
    const tab = await context.newPage();
    await tab.goto(`${srv.origin}/carrier-specimen.html`);
    await tab.waitForTimeout(1200);
    const id = await tabIdOf(worker, srv.origin);
    const frames = [];
    const fresh = async () => {
      const p = await context.newPage();
      await p.setViewportSize({ width: 380, height: 640 });
      await p.emulateMedia({ colorScheme: scheme });
      await p.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(id)}`);
      await p.waitForTimeout(700);
      return p;
    };
    const grab = async (p, label) => {
      const f = join(OUT, `state-${label}-${scheme}.png`);
      await p.screenshot({ path: f, clip: await p.locator('main.pop').boundingBox() });
      frames.push(f);
      await p.close();
    };
    let p = await fresh();
    await grab(p, '1-rest');
    p = await fresh();
    await p.getByRole('button', { name: /Show all on page/ }).hover();
    await p.waitForTimeout(250);
    await grab(p, '2-hover-primary');
    p = await fresh();
    await p.keyboard.press('Tab');
    await p.waitForTimeout(150);
    await grab(p, '3-focus-first');
    p = await fresh();
    for (let i = 0; i < 3; i++) await p.keyboard.press('Tab');
    await p.waitForTimeout(150);
    await grab(p, '4-focus-row');
    p = await fresh();
    const btn = p.getByRole('button', { name: /Show all on page/ });
    const box = await btn.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.waitForTimeout(250);
    await grab(p, '5-pressed-primary');
    await tab.close();
    try {
      const tmp = mkdtempSync(join(tmpdir(), 'catchline-states-'));
      frames.forEach((f, n) => {
        copyFileSync(f, join(tmp, `n${String(n + 1).padStart(3, '0')}.png`));
      });
      execFileSync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        '1',
        '-i',
        join(tmp, 'n%03d.png').split(sep).join('/'),
        '-vf',
        'tile=5x1',
        '-frames:v',
        '1',
        join(OUT, `states-popup-${scheme}.png`),
      ]);
      rmSync(tmp, { recursive: true, force: true });
    } catch (e) {
      console.log('state sheet skipped:', String(e.message).split('\n')[0]);
    }
    console.log('states', scheme, frames.length);
  }
}

if (want('pages')) {
  for (const scheme of SCHEMES) {
    for (const [w, ht] of WIDTHS) {
      for (const name of ['options', 'welcome']) {
        const p = await context.newPage();
        await p.setViewportSize({ width: w, height: ht });
        await p.emulateMedia({ colorScheme: scheme });
        await p.goto(`chrome-extension://${extensionId}/${name}.html`);
        await p.waitForTimeout(700);
        await shot(p, `${name}-${String(w)}-${scheme}`, { fullPage: true });
        if (name === 'welcome') {
          await p
            .locator('catchline-markers button')
            .first()
            .click({ force: true })
            .catch(() => undefined);
          await p
            .waitForFunction(
              () =>
                document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card'),
              null,
              { timeout: 6000 },
            )
            .catch(() => undefined);
          await p.evaluate(() =>
            document
              .querySelector('catchline-overlay')
              ?.shadowRoot?.getAnimations()
              .forEach((a) => a.finish()),
          );
          await p.waitForTimeout(300);
          await shot(p, `welcome-card-${String(w)}-${scheme}`);
        }
        await p.close();
      }
    }
  }
  // Options states: error on save, loading skeleton.
  for (const scheme of SCHEMES) {
    const p = await context.newPage();
    await p.setViewportSize({ width: 768, height: 900 });
    await p.emulateMedia({ colorScheme: scheme });
    await p.addInitScript(() => {
      chrome.storage.local.set = () => Promise.reject(new Error('quota'));
    });
    await p.goto(`chrome-extension://${extensionId}/options.html`);
    await p.waitForTimeout(500);
    await p.getByRole('switch', { name: /underline/ }).click();
    await p.waitForTimeout(400);
    await shot(p, `options-error-768-${scheme}`, { fullPage: true });
    await p.close();
    const q = await context.newPage();
    await q.setViewportSize({ width: 768, height: 700 });
    await q.emulateMedia({ colorScheme: scheme });
    await q.addInitScript(() => {
      const orig = chrome.storage.local.get.bind(chrome.storage.local);
      chrome.storage.local.get = (...a) =>
        new Promise((ok) => setTimeout(() => ok(orig(...a)), 4000));
    });
    await q.goto(`chrome-extension://${extensionId}/options.html`);
    await q.waitForTimeout(500);
    await shot(q, `options-loading-768-${scheme}`);
    await q.close();
  }
}

await h.close();
srv.close();
