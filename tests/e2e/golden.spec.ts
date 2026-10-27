// AC-F8.1: the share image is compared with a golden, at most 0.5% of pixels different.
//
// The golden (tests/e2e/golden/share-carrier.png) was painted by this build on this machine. The
// image carries today's date, so a few glyphs change from day to day; the budget absorbs that.
// Regenerate after an intentional design change, or on a different OS, with UPDATE_GOLDEN=1.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, openCard, openPage, test } from './extension';

const GOLDEN_DIR = resolve(import.meta.dirname, 'golden');
const BUDGET = 0.005;

/** Fraction of pixels whose colour differs by more than 24/255 in any channel, decoded in-browser. */
async function diffRatio(
  page: Page,
  a: Buffer,
  b: Buffer,
): Promise<{ w: number; h: number; ratio: number }> {
  return page.evaluate(
    async ([x, y]) => {
      const load = async (b64: string): Promise<ImageData> => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [ia, ib] = await Promise.all([load(x as string), load(y as string)]);
      if (ia.width !== ib.width || ia.height !== ib.height) {
        return { w: ia.width, h: ia.height, ratio: 1 };
      }
      let bad = 0;
      for (let i = 0; i < ia.data.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          if (Math.abs((ia.data[i + k] ?? 0) - (ib.data[i + k] ?? 0)) > 24) {
            bad++;
            break;
          }
        }
      }
      return { w: ia.width, h: ia.height, ratio: bad / (ia.width * ia.height) };
    },
    [a.toString('base64'), b.toString('base64')],
  );
}

test.describe('share image golden (F8)', () => {
  test('AC-F8.1: the carrier card paints the golden within 0.5% of pixels', async ({
    context,
    site,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await openCard(page);
    await page.evaluate(() => {
      document
        .querySelector('catchline-overlay')
        ?.shadowRoot?.getAnimations()
        .forEach((a) => {
          a.finish();
        });
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => {
        (
          document
            .querySelector('catchline-overlay')
            ?.shadowRoot?.querySelector('button[aria-label="Save image"]') as HTMLElement
        ).click();
      }),
    ]);
    const png = readFileSync(await download.path());
    const goldenPath = join(GOLDEN_DIR, 'share-carrier.png');
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(goldenPath)) {
      mkdirSync(GOLDEN_DIR, { recursive: true });
      writeFileSync(goldenPath, png);
      if (process.env.UPDATE_GOLDEN !== '1') {
        throw new Error('No golden existed; one was written. Review it and run the test again.');
      }
      return;
    }
    const scratch = await context.newPage();
    const { w, h, ratio } = await diffRatio(scratch, png, readFileSync(goldenPath));
    expect([w, h]).toEqual([1200, 630]);
    expect(ratio, `${(ratio * 100).toFixed(3)}% of pixels differ`).toBeLessThanOrEqual(BUDGET);
  });

  test('AC-F8.1: the diff check itself can fail (a different image is far over budget)', async ({
    context,
  }) => {
    const golden = readFileSync(join(GOLDEN_DIR, 'share-carrier.png'));
    const scratch = await context.newPage();
    // An image of another size can never pass.
    const tiny = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    expect((await diffRatio(scratch, tiny, golden)).ratio).toBe(1);
    expect((await diffRatio(scratch, golden, golden)).ratio).toBe(0);
  });
});
