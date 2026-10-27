import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

function watch(page: Page): { errors: string[]; foreign: string[] } {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== 'http://localhost:4173' && !/^(data|blob):/.test(r.url()))
      foreign.push(r.url());
  });
  return { errors, foreign };
}

test.describe('landing', () => {
  test('paints the claim, the settled specimen and makes no foreign requests', async ({ page }) => {
    const w = watch(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'The catch, next to the claim.',
    );
    await expect(page.locator('#hero-card')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Try it in your browser, no install' }),
    ).toHaveAttribute('href', './app/');
    await expect(page.locator('#specimen-label')).toHaveText('Specimen page. Not a real offer.');
    await page.waitForTimeout(1500);
    await expect(page.locator('#proof-other')).toHaveText('0');
    expect(w.foreign).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('replay runs the flight and settles back to the docked card', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500); // autoplay finishes
    await page.click('#replay');
    await expect(page.locator('.flight')).toHaveCount(1, { timeout: 500 });
    await expect(page.locator('.flight')).toHaveCount(0, { timeout: 2500 });
    await expect(page.locator('#hero-card')).toBeVisible();
    await expect(page.locator('#hero-card .chip')).toHaveCount(3);
    await expect(page.locator('#footnote')).toHaveClass(/ghost/);
  });

  test('reduced motion never flies', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(2500);
    let flew = false;
    await page.exposeFunction('noteFlight', () => {
      flew = true;
    });
    await page.evaluate(() => {
      new MutationObserver((m) => {
        if (
          m.some((r) =>
            Array.from(r.addedNodes).some((n) => (n as Element).classList.contains('flight')),
          )
        ) {
          (window as unknown as { noteFlight(): void }).noteFlight();
        }
      }).observe(document.body, { subtree: true, childList: true });
    });
    await page.click('#replay');
    await page.waitForTimeout(600);
    expect(flew).toBe(false);
    await expect(page.locator('#hero-card')).toBeVisible();
    await ctx.close();
  });

  test('works with JavaScript off', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#hero-card .chip')).toHaveCount(3);
    await expect(page.locator('#footnote')).toBeVisible();
    await ctx.close();
  });

  test('has no horizontal scroll at 375', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto('/');
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
    await ctx.close();
  });
});

test.describe('web app', () => {
  test('empty state offers a sample and states the privacy line', async ({ page }) => {
    const w = watch(page);
    await page.goto('/app/');
    await expect(
      page.getByText('Runs entirely in your browser. Nothing is uploaded.'),
    ).toBeVisible();
    await expect(page.getByText('Nothing scanned yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try a sample' }).first()).toBeVisible();
    await expect(page.getByText(/CORS/)).toBeVisible();
    expect(w.errors).toEqual([]);
  });

  test('sample: success, card, flight, ghost outline, Escape', async ({ page }) => {
    const w = watch(page);
    await page.goto('/app/');
    await page.getByRole('button', { name: 'Try a sample' }).first().click();
    await expect(page.locator('.result__summary')).toHaveText('3 catches: $35 + 36 months hidden');
    await expect(page.locator('.catch-list .catch-row')).toHaveCount(3);
    await page.locator('.marker').first().click();
    await expect(page.locator('.flight')).toHaveCount(1, { timeout: 600 });
    await expect(page.locator('.card .chip')).toHaveCount(3);
    await expect(page.locator('.card .fine__text mark').first()).toBeVisible();
    await expect(page.locator('.ghost')).toHaveCount(1);
    await expect(page.locator('.tether')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.card')).toHaveCount(0);
    await expect(page.locator('.ghost')).toHaveCount(0);
    expect(w.foreign).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('J and K step between catches without animation', async ({ page }) => {
    await page.goto('/app/#sample=carrier-specimen');
    await expect(page.locator('.result__summary')).toBeVisible();
    await page.keyboard.press('j');
    await expect(page.locator('.card__claim')).toHaveText('$0/mo*');
    await page.keyboard.press('j');
    await expect(page.locator('.card__claim')).toContainText('Unlimited');
    expect(await page.locator('.flight').count()).toBe(0);
    await page.keyboard.press('k');
    await expect(page.locator('.card__claim')).toHaveText('$0/mo*');
  });

  test('error state: nothing to scan, then recovery by pasting text', async ({ page }) => {
    await page.goto('/app/');
    await page.getByRole('button', { name: 'Find the catches' }).click();
    await expect(page.getByRole('alert')).toContainText('Nothing to scan');
    await page.fill(
      '#source',
      'Unlimited data¹ for $0/mo*\n\n*With a 36-month installment agreement. $35 activation fee. Autopay required.\n¹Speeds may slow after 50GB.',
    );
    await page.getByRole('button', { name: 'Find the catches' }).click();
    await expect(page.locator('.result__summary')).toContainText('catch');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('not-found sample shows the honest card and the original text is never hidden', async ({
    page,
  }) => {
    await page.goto('/app/#sample=not-found');
    await expect(page.locator('.catch-row').first()).toBeVisible();
    await page.locator('.marker').first().click();
    await expect(page.locator('.card__panel')).toContainText('No footnote found');
  });

  test('many-to-one: sentence first, expander reveals the whole offer block', async ({ page }) => {
    await page.goto('/app/#sample=many-to-one');
    await page.locator('.marker').first().click();
    const more = page.locator('.fine__more');
    await expect(more).toContainText('Show all offer details');
    const short = (await page.locator('.fine__text').textContent())?.length ?? 0;
    await more.click();
    const long = (await page.locator('.fine__text').textContent())?.length ?? 0;
    expect(long).toBeGreaterThan(short * 2);
    await expect(more).toHaveText('Show less');
  });

  test('Save image produces a 1200 x 630 PNG', async ({ page }) => {
    await page.goto('/app/#sample=carrier-specimen');
    await page.locator('.marker').first().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('.card [data-action="image"]'),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^catchline-ridgeline-example-\d{4}-\d{2}-\d{2}\.png$/,
    );
    const path = await download.path();
    const buf = readFileSync(path);
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    expect(buf.readUInt32BE(16)).toBe(1200);
    expect(buf.readUInt32BE(20)).toBe(630);
  });

  test('phone: 44px touch targets, no horizontal scroll, card inline under the claim', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto('/app/#sample=carrier-specimen');
    await expect(page.locator('.result__summary')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await page.locator('.marker').first().tap();
    await expect(page.locator('.card--inline')).toBeVisible();
    await page.waitForTimeout(1300); // let the dock animation settle before measuring
    const small = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('button, a.btn, label.btn, summary, .catch-row'),
      )
        .filter(
          (el) =>
            el.offsetParent !== null && !el.classList.contains('marker') && !el.closest('.sr-only'),
        )
        .map((el) => ({ el: el.className || el.tagName, h: el.getBoundingClientRect().height }))
        .filter((x) => x.h < 43.5),
    );
    expect(small).toEqual([]);
    await ctx.close();
  });

  test('works offline after the first load and is installable', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/app/');
    await page.waitForFunction(
      () =>
        navigator.serviceWorker.controller !== null ||
        navigator.serviceWorker.ready.then(() => true),
    );
    await expect(page.locator('#offline-note')).toHaveText('Ready to use offline.', {
      timeout: 10_000,
    });
    await page.reload(); // now controlled by the worker
    await ctx.setOffline(true);
    await page.goto('/app/#sample=bank-specimen');
    await page.reload(); // a real offline load, served by the worker
    await expect(page.locator('.result__summary')).toContainText('5 catches');
    await page.locator('.marker').first().click();
    await expect(page.locator('.card .chip').first()).toBeVisible();
    // The manifest, icons and the landing page are in the worker's cache (page fetch() is closed by CSP).
    const cached = await page.evaluate(async () => {
      const href = document.querySelector<HTMLLinkElement>('link[rel=manifest]')?.href ?? '';
      const icon = new URL('../icons/icon-512.png', location.href).href;
      return [!!(await caches.match(href)), !!(await caches.match(icon))];
    });
    expect(cached).toEqual([true, true]);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await ctx.close();
  });
});
