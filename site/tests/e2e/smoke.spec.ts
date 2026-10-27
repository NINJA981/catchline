// Smoke test for the landing page (site/): it loads, says what it is, every internal link and
// every file it names resolves, and it works without the app. Desktop only.

import { expect, test, watch } from './helpers';

test.describe('landing smoke', () => {
  test('loads clean: title, one h1, landmarks, no console errors, no foreign requests', async ({
    page,
  }) => {
    const w = watch(page);
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Catchline/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    expect(await page.locator('html').getAttribute('lang')).toBe('en');
    await page.waitForLoadState('networkidle');
    expect(w.errors).toEqual([]);
    expect(w.foreign).toEqual([]);
  });

  test('every internal link resolves, and in-page anchors point at real ids', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThan(5);
    const seen = new Set<string>();
    for (const href of hrefs) {
      const url = new URL(href);
      expect(url.origin, href).toBe(new URL(page.url()).origin);
      if (url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (url.pathname === '/' && id) {
          await expect(page.locator(`[id="${id}"]`), href).toHaveCount(1);
        }
      }
      const key = url.origin + url.pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      expect((await request.get(key)).status(), href).toBe(200);
    }
  });

  test('the files the page names exist: icons, manifest, social image, robots, llms.txt', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const targets = await page.evaluate(() => {
      const abs = (v: string | null): string | null => (v ? new URL(v, location.href).href : null);
      return [
        ...Array.from(
          document.querySelectorAll(
            'link[rel~=icon], link[rel=apple-touch-icon], link[rel=manifest]',
          ),
        ).map((l) => abs(l.getAttribute('href'))),
        abs(document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null),
      ].filter((v): v is string => v !== null);
    });
    expect(targets.length).toBeGreaterThanOrEqual(4);
    for (const t of [
      ...targets,
      new URL('/robots.txt', page.url()).href,
      new URL('/llms.txt', page.url()).href,
    ]) {
      const r = await request.get(t);
      expect(r.status(), t).toBe(200);
    }
  });

  test('the hero card shows the carrier specimen and the privacy proof counts zero outside requests', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText(/Specimen page\. Not a real offer\./).first()).toBeVisible();
    await page.locator('#privacy').scrollIntoViewIfNeeded();
    await expect(page.locator('#privacy')).toContainText(/0 requests|zero requests/i);
  });

  test('the call to action leads into a working app', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="./app/"]').first().click();
    await expect(page).toHaveURL(/\/app\/$/);
    await expect(page.getByRole('button', { name: 'Find the catches' })).toBeVisible();
  });
});
