// Web app (/app) user flows, run at a phone (375 x 812, touch) and at desktop size.
// Covers the sample flow, the paste flow, the upload flow, reduced motion and the share image.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, FIXTURE_DIR, isPhone, press, test, watch } from './helpers';

const SAMPLES = [
  { id: 'carrier-specimen', label: 'Phone plan', counted: 3, listed: 3 },
  { id: 'bank-specimen', label: 'Credit card', counted: 5, listed: 5 },
  { id: 'retail-specimen', label: 'Retail sale', counted: 4, listed: 4 },
  { id: 'streaming-specimen', label: 'Streaming', counted: 3, listed: 3 },
  { id: 'saas-specimen', label: 'Software pricing', counted: 4, listed: 4 },
  { id: 'travel-specimen', label: 'Airline fares', counted: 3, listed: 3 },
  { id: 'many-to-one', label: 'One asterisk, fourteen claims', counted: 12, listed: 14 },
  { id: 'not-found', label: 'Fine print not on the page', counted: 0, listed: 3 },
] as const;

const fixture = (name: string): string => readFileSync(join(FIXTURE_DIR, name), 'utf8');

test.describe('sample flow', () => {
  for (const s of SAMPLES) {
    test(`AC-W2/AC-W3: "${s.label}" sample lists ${String(s.listed)} catches and opens a card`, async ({
      page,
    }) => {
      const w = watch(page);
      await page.goto('/app/');
      if (!(await page.locator('#samples').evaluate((d: HTMLDetailsElement) => d.open))) {
        await press(page.locator('#samples summary'));
      }
      await press(page.locator('.sample', { hasText: s.label }));
      await expect(page.locator('#result .result__summary')).toBeVisible();
      await expect(page.locator('.catch-list .catch-row')).toHaveCount(s.listed);
      if (s.counted > 0) {
        await expect(page.locator('.result__summary')).toContainText(`${String(s.counted)} catch`);
      }
      await press(page.locator('.marker').first());
      await expect(page.locator('.card')).toBeVisible();
      if (s.id === 'not-found') {
        await expect(page.locator('.card__panel')).toContainText(/No (footnote|terms) found/);
      } else {
        await expect(page.locator('.card .fine__text')).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.card')).toHaveCount(0);
      expect(w.foreign).toEqual([]);
      expect(w.errors).toEqual([]);
    });
  }

  test('AC-W2: the catch list opens the same card as the marker, and the hash selects a sample', async ({
    page,
  }) => {
    await page.goto('/app/#sample=carrier-specimen');
    await expect(page.locator('.result__summary')).toHaveText('3 catches: $35 + 36 months hidden');
    await press(page.locator('.catch-row').nth(1));
    await expect(page.locator('.card__claim')).toContainText('Unlimited');
    await expect(page.locator('.card .chip')).not.toHaveCount(0);
  });
});

test.describe('paste flow', () => {
  test('AC-W4: pasted plain text finds the catch; Clear returns to the empty state', async ({
    page,
  }) => {
    await page.goto('/app/');
    await page.fill(
      '#source',
      'Unlimited data¹ for $0/mo*\n\n*With a 36-month installment agreement. $35 activation fee. Autopay required.\n¹Speeds may slow after 50GB.',
    );
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.locator('.result__summary')).toContainText('catch');
    await expect(page.locator('.catch-row')).toHaveCount(2);
    await press(page.getByRole('button', { name: 'Clear' }));
    await expect(page.locator('#source')).toHaveValue('');
    await expect(page.getByText('Nothing scanned yet')).toBeVisible();
  });

  test('AC-W4: pasted page source gives the same result as the bundled sample', async ({
    page,
  }) => {
    await page.goto('/app/');
    await page.fill('#source', fixture('carrier-specimen.html'));
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.locator('.result__summary')).toHaveText('3 catches: $35 + 36 months hidden');
    await expect(page.locator('.catch-row')).toHaveCount(3);
    await press(page.locator('.marker').first());
    await expect(page.locator('.card .chip')).toHaveCount(3);
  });

  test('AC-W4: text with no markers says so and offers a sample instead of a blank page', async ({
    page,
  }) => {
    await page.goto('/app/');
    await page.fill('#source', 'A plain sentence with no stars, daggers or fine print at all.');
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.getByRole('heading', { name: 'No fine print found' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try a sample' }).last()).toBeVisible();
  });

  test('AC-W4: an empty box is an error, and a following valid paste clears it', async ({
    page,
  }) => {
    await page.goto('/app/');
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.getByRole('alert')).toContainText('Nothing to scan');
    await page.fill('#source', fixture('bank-specimen.html'));
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.locator('.result__summary')).toContainText('5 catches');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('pasting HTML never runs its scripts or loads its images', async ({ page }) => {
    const w = watch(page);
    await page.goto('/app/');
    await page.fill(
      '#source',
      '<p>Free shipping*</p><script>window.__pwned = true</script><img src="https://tracker.example/p.gif"><footer>*Orders over $50.</footer>',
    );
    await press(page.getByRole('button', { name: 'Find the catches' }));
    await expect(page.locator('#result .result__summary, #result .panel')).toBeVisible();
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
    expect(w.foreign).toEqual([]);
  });
});

test.describe('upload flow', () => {
  test('AC-W4: a saved page from disk is scanned, and its source fills the box', async ({
    page,
  }) => {
    const w = watch(page);
    await page.goto('/app/');
    await page.setInputFiles('#file', join(FIXTURE_DIR, 'bank-specimen.html'));
    await expect(page.locator('.result__summary')).toContainText('5 catches');
    await expect(page.locator('.result__head')).toContainText('Saved page from your device');
    await expect(page.locator('#source')).not.toHaveValue('');
    await press(page.locator('.marker').first());
    await expect(page.locator('.card .chip').first()).toBeVisible();
    expect(w.foreign).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test('AC-W4: a saved text file works', async ({ page }) => {
    await page.goto('/app/');
    await page.setInputFiles('#file', {
      name: 'offer.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'Free shipping on every order*\n\n*Orders of $50+ only. Contiguous US only. While supplies last.',
      ),
    });
    await expect(page.locator('.result__summary')).toContainText('catch');
    await expect(page.locator('.catch-row')).toHaveCount(1);
  });

  test('AC-W4: an empty file is the "Nothing to scan" error, not a blank result', async ({
    page,
  }) => {
    await page.goto('/app/');
    await page.setInputFiles('#file', {
      name: 'empty.html',
      mimeType: 'text/html',
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByRole('alert')).toContainText('Nothing to scan');
  });

  test('AC-W4: a file over the size cap is refused with a plain message', async ({ page }) => {
    await page.goto('/app/');
    await page.setInputFiles('#file', {
      name: 'huge.html',
      mimeType: 'text/html',
      buffer: Buffer.alloc(2_100_000, 'a'),
    });
    await expect(page.getByRole('alert')).toContainText(/2 million/);
  });
});

test.describe('motion and sharing', () => {
  test('AC-W7: the flight plays on the first card open, once, and clears itself', async ({
    page,
  }) => {
    await page.goto('/app/#sample=carrier-specimen');
    await expect(page.locator('.result__summary')).toBeVisible();
    await press(page.locator('.marker').first());
    await expect(page.locator('.flight')).toHaveCount(1, { timeout: 600 });
    await expect(page.locator('.flight')).toHaveCount(0, { timeout: 3000 });
    await expect(page.locator('.card')).toBeVisible();
  });

  test('AC-W7: with reduced motion there is no flight clone', async ({ browser }) => {
    const phone = isPhone();
    const ctx = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: phone ? { width: 375, height: 812 } : { width: 1280, height: 800 },
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4619/app/#sample=carrier-specimen');
    await expect(page.locator('.result__summary')).toBeVisible();
    await press(page.locator('.marker').first());
    await expect(page.locator('.card')).toBeVisible();
    expect(await page.locator('.flight').count()).toBe(0);
    await ctx.close();
  });

  test('AC-W6: Save image downloads catchline-<host>-<date>.png at exactly 1200 x 630', async ({
    page,
  }) => {
    await page.goto('/app/#sample=bank-specimen');
    await press(page.locator('.marker').first());
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      press(page.locator('.card [data-action="image"]')),
    ]);
    expect(download.suggestedFilename()).toMatch(/^catchline-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.png$/);
    const png = readFileSync(await download.path());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  test('AC-W8: no horizontal scroll with results and a card open', async ({ page }) => {
    await page.goto('/app/#sample=many-to-one');
    await expect(page.locator('.result__summary')).toBeVisible();
    await press(page.locator('.marker').first());
    await expect(page.locator('.card')).toBeVisible();
    await page.waitForTimeout(1300);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
  });
});
