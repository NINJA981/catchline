// axe-core on every surface of the site, light and dark, at phone and desktop size (the project
// decides the size). Zero violations is the bar; nothing is excluded.

import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { expect, FIXTURE_DIR, press, test, type Page } from './helpers';

async function settle(page: Page): Promise<void> {
  // Let the card flight and dock animation finish so axe sees final colors and positions.
  await expect(page.locator('.flight')).toHaveCount(0);
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))),
  );
  await page.waitForTimeout(250);
}

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, label).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('landing page', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForTimeout(600);
      await scan(page, 'landing');
    });

    test('app: empty state, with the sample list open', async ({ page }) => {
      await page.goto('/app/');
      await expect(page.getByText('Nothing scanned yet')).toBeVisible();
      await scan(page, 'app empty');
      if (!(await page.locator('#samples').evaluate((d: HTMLDetailsElement) => d.open))) {
        await press(page.locator('#samples summary'));
      }
      await scan(page, 'app empty, samples open');
    });

    test('app: error state and the no-fine-print state', async ({ page }) => {
      await page.goto('/app/');
      await press(page.getByRole('button', { name: 'Find the catches' }));
      await expect(page.getByRole('alert')).toContainText('Nothing to scan');
      await scan(page, 'app error');
      await page.fill('#source', 'Just a sentence with nothing to find.');
      await press(page.getByRole('button', { name: 'Find the catches' }));
      await expect(page.getByRole('heading', { name: 'No fine print found' })).toBeVisible();
      await scan(page, 'app no fine print');
    });

    test('app: results for every sample', async ({ page }) => {
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
        await page.goto(`/app/#sample=${id}`);
        await page.reload();
        await expect(page.locator('.catch-row').first()).toBeVisible();
        await scan(page, `app results ${id}`);
      }
    });

    test('app: an open card (matched, no footnote, many-to-one expanded)', async ({ page }) => {
      await page.goto('/app/#sample=carrier-specimen');
      await press(page.locator('.marker').first());
      await expect(page.locator('.card')).toBeVisible();
      await settle(page);
      await scan(page, 'card matched');

      await page.goto('/app/#sample=not-found');
      await page.reload();
      await press(page.locator('.marker').first());
      await expect(page.locator('.card__panel')).toContainText(/No (footnote|terms) found/);
      await settle(page);
      await scan(page, 'card not found');

      await page.goto('/app/#sample=many-to-one');
      await page.reload();
      await press(page.locator('.marker').first());
      await press(page.locator('.fine__more'));
      await expect(page.locator('.fine__more')).toHaveText('Show less');
      await settle(page);
      await scan(page, 'card many-to-one expanded');
    });

    test('app: results from an uploaded file', async ({ page }) => {
      await page.goto('/app/');
      await page.setInputFiles('#file', join(FIXTURE_DIR, 'streaming-specimen.html'));
      await expect(page.locator('.result__summary')).toBeVisible();
      await scan(page, 'app upload results');
    });
  });
}
