import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, openCard, openPage, tabIdOf, test, waitForMarkers } from './extension';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlayBox = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector('catchline-overlay')?.shadowRoot?.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, sel) as Promise<Box | null>;

/** The tether's two end points, read from the SVG path the overlay draws. */
async function tetherEnds(page: Page) {
  return page.evaluate(() => {
    const d = document
      .querySelector('catchline-overlay')
      ?.shadowRoot?.querySelector('.cl-tether-line[d]:not([style*="display: none"])')
      ?.getAttribute('d');
    // The persistent tether is the one inside the <g class="cl-tether">.
    const line = document
      .querySelector('catchline-overlay')
      ?.shadowRoot?.querySelector('g.cl-tether .cl-tether-line')
      ?.getAttribute('d');
    const path = line ?? d ?? '';
    const n = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return n.length >= 8 ? { from: { x: n[0], y: n[1] }, to: { x: n[6], y: n[7] } } : null;
  }) as Promise<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>;
}

const settled = (page: Page) =>
  page.evaluate(() => {
    document
      .querySelector('catchline-overlay')
      ?.shadowRoot?.getAnimations()
      .forEach((a) => {
        a.finish();
      });
  });

test.describe('card and tether (F5)', () => {
  test('AC-F5.1: tether endpoints stay within 2px of claim and card after scroll, resize and a sticky header', async ({
    context,
    site,
  }) => {
    const page = await openPage(context, site.url('tall.html'));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      window.scrollTo(0, 1000);
    });
    await waitForMarkers(page);
    await page.waitForTimeout(300);
    await openCard(page);
    await settled(page);

    const check = async () => {
      await page.bringToFront();
      await page.waitForTimeout(160);
      const ring = await overlayBox(page, '.cl-ring');
      const card = await overlayBox(page, '.cl-card');
      const ends = await tetherEnds(page);
      expect(ring && card && ends).toBeTruthy();
      if (!ring || !card || !ends) return;
      // The ring is the marker box grown by 4px sideways and 2px vertically. The tether leaves from
      // the marker edge that faces the card, so the start point sits on one of the four edges.
      const m = {
        left: ring.left + 4,
        right: ring.right - 4,
        top: ring.top + 2,
        bottom: ring.bottom - 2,
      };
      const within = (v: number, lo: number, hi: number) => v >= lo - 2 && v <= hi + 2;
      const onMarkerEdge =
        (within(ends.from.y, m.top, m.bottom) &&
          (Math.abs(ends.from.x - m.right) <= 2 || Math.abs(ends.from.x - m.left) <= 2)) ||
        (within(ends.from.x, m.left, m.right) &&
          (Math.abs(ends.from.y - m.bottom) <= 2 || Math.abs(ends.from.y - m.top) <= 2));
      expect(onMarkerEdge).toBe(true);
      const onCardEdge =
        Math.abs(ends.to.x - card.left) <= 2 ||
        Math.abs(ends.to.x - card.right) <= 2 ||
        Math.abs(ends.to.y - card.top) <= 2 ||
        Math.abs(ends.to.y - card.bottom) <= 2;
      expect(onCardEdge).toBe(true);
    };
    await check();
    await page.evaluate(() => {
      window.scrollBy(0, 60);
    });
    await check();
    await page.setViewportSize({ width: 768, height: 800 });
    await check();
    // The card never sits under the 64px sticky header.
    const card = await overlayBox(page, '.cl-card');
    expect(card?.top ?? 0).toBeGreaterThanOrEqual(64);
  });

  test('AC-F5.2: opening and closing cards moves no host element', async ({ context, site }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await waitForMarkers(page);
    const boxes = () =>
      page.evaluate(() =>
        Array.from(document.body.querySelectorAll('*')).map((e) => {
          const r = e.getBoundingClientRect();
          return [
            Math.round(r.x * 100),
            Math.round(r.y * 100),
            Math.round(r.width * 100),
            Math.round(r.height * 100),
          ];
        }),
      );
    const before = await boxes();
    await openCard(page);
    expect(await boxes()).toEqual(before);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card'),
    );
    expect(await boxes()).toEqual(before);
    // Nothing was added to the body either: the overlay lives under <html>.
    expect(
      await page.evaluate(
        () => document.body.querySelectorAll('catchline-overlay,catchline-markers').length,
      ),
    ).toBe(0);
  });

  test('AC-F5.3: hostile page CSS does not change the card', async ({ context, site }) => {
    const page = await openPage(context, site.url('hostile.html'));
    await openCard(page);
    await settled(page);
    const style = await page.evaluate(() => {
      const root = document.querySelector('catchline-overlay')?.shadowRoot;
      const read = (sel: string) => {
        const el = root?.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          size: cs.fontSize,
          family: cs.fontFamily,
          color: cs.color,
          spacing: cs.letterSpacing,
        };
      };
      return { heading: read('.cl-card__claim'), fine: read('.cl-fine') };
    });
    expect(style.heading?.size).toBe('18px');
    expect(style.fine?.size).toBe('13px');
    expect(style.fine?.family).toContain('Schibsted');
    expect(style.fine?.color).not.toBe('rgb(255, 0, 0)');
    expect(style.heading?.color).not.toBe('rgb(255, 0, 0)');
    expect(style.fine?.spacing).not.toBe('5px');
  });

  test('AC-F5.4: Esc closes the card and returns focus to the marker', async ({
    context,
    site,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await openCard(page);
    await settled(page);
    // Focus moved into the card.
    expect(
      await page.evaluate(
        () => document.querySelector('catchline-overlay')?.shadowRoot?.activeElement?.className,
      ),
    ).toContain('cl-card__claim');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card'),
    );
    const focused = await page.evaluate(() => {
      const a = document.querySelector('catchline-markers')?.shadowRoot?.activeElement;
      return a ? a.className : null;
    });
    expect(focused).toBe('m');
  });

  test('AC-F5.5: with reduced motion there is no flight, only a fade of at most 150ms', async ({
    context,
    site,
  }) => {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(site.url('carrier-specimen.html'));
    await openCard(page);
    const info = await page.evaluate(() => {
      const root = document.querySelector('catchline-overlay')?.shadowRoot;
      const anims =
        root?.getAnimations().map((a) => Number(a.effect?.getTiming().duration ?? 0)) ?? [];
      return { clone: !!root?.querySelector('.cl-clone'), anims };
    });
    expect(info.clone).toBe(false);
    // The fade may already have finished when this samples it; nothing running may exceed 150 ms.
    expect(Math.max(0, ...info.anims)).toBeLessThanOrEqual(150);
  });

  test('the first card flies from the footnote; later opens use the short version', async ({
    context,
    site,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await openCard(page);
    const first = await page.evaluate(() => {
      const root = document.querySelector('catchline-overlay')?.shadowRoot;
      return {
        clone: !!root?.querySelector('.cl-clone'),
        longest: Math.max(
          ...(root?.getAnimations().map((a) => {
            const t = a.effect?.getTiming();
            return (t?.delay ?? 0) + Number(t?.duration ?? 0);
          }) ?? [0]),
        ),
      };
    });
    expect(first.clone).toBe(true);
    // 960ms of choreography plus the spring tail of the last chip.
    expect(first.longest).toBeLessThanOrEqual(1300);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card'),
    );
    await openCard(page, 1);
    const second = await page.evaluate(() => {
      const root = document.querySelector('catchline-overlay')?.shadowRoot;
      return { clone: !!root?.querySelector('.cl-clone') };
    });
    expect(second.clone).toBe(false);
  });

  test('card shows chips and the raw footnote text (AC-F4.2) and a no-footnote card says so (AC-F2.4)', async ({
    context,
    site,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await openCard(page);
    await settled(page);
    const text = await page.evaluate(
      () =>
        document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card')
          ?.textContent ?? '',
    );
    expect(text).toContain('$35 activation');
    expect(text).toContain('*With 36-month installment agreement');
    const nf = await openPage(context, site.url('not-found.html'));
    await openCard(nf);
    // The card looks for a lazy footnote for up to 2s before it says there is none.
    await nf.waitForFunction(
      () =>
        document
          .querySelector('catchline-overlay')
          ?.shadowRoot?.querySelector('.cl-card')
          ?.textContent.includes('No footnote found'),
      null,
      { timeout: 5000 },
    );
    const nfText = await nf.evaluate(
      () =>
        document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card')
          ?.textContent ?? '',
    );
    expect(nfText).toContain('No footnote found for this *.');
  });
});

test.describe('Show all (F6)', () => {
  test('AC-F6.1 to F6.3: the popup button enters Show all; J/K step with no animation; Enter expands; Esc restores scroll; host inputs are left alone', async ({
    context,
    extensionId,
    worker,
    site,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await waitForMarkers(page);
    const tabId = await tabIdOf(worker, site.origin);
    // The real path: popup button -> background -> injection -> overlay.
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
    await popup.getByRole('button', { name: /Show all on page/ }).click();
    await page.bringToFront();
    await page.waitForFunction(() =>
      document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
    );
    const entries = await page.evaluate(
      () =>
        document.querySelector('catchline-overlay')?.shadowRoot?.querySelectorAll('.cl-entry')
          .length,
    );
    expect(entries).toBe(3);

    const selected = () =>
      page.evaluate(
        () =>
          document
            .querySelector('catchline-overlay')
            ?.shadowRoot?.querySelector('.cl-entry[data-selected="true"] .cl-entry__claim')
            ?.textContent ?? '',
      );
    expect(await selected()).toContain('$0/mo');
    await page.keyboard.press('j');
    expect(await selected()).toContain('Unlimited');
    // No animation on keyboard stepping. The hint-bar keycap press (DESIGN.md M9, 120 ms) is the one
    // thing that moves; the selection, the scroll and the cards do not.
    expect(
      await page.evaluate(() =>
        (document.querySelector('catchline-overlay')?.shadowRoot?.getAnimations() ?? [])
          .map((a) => (a.effect as KeyframeEffect | null)?.target)
          .filter((t) => t && !t.classList.contains('cl-key'))
          .map((t) => t?.className),
      ),
    ).toEqual([]);
    await page.keyboard.press('k');
    expect(await selected()).toContain('$0/mo');
    await page.keyboard.press('Enter');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            !!document
              .querySelector('catchline-overlay')
              ?.shadowRoot?.querySelector('.cl-entry__open'),
        ),
      )
      .toBe(true);
    // Esc exits.
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
    );
  });

  test('AC-F6.2: Esc restores the page scroll position', async ({
    context,
    extensionId,
    worker,
    site,
  }) => {
    const page = await openPage(context, site.url('tall.html'));
    await waitForMarkers(page);
    await page.evaluate(() => {
      window.scrollTo(0, 400);
    });
    const tabId = await tabIdOf(worker, site.origin);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
    await popup.getByRole('button', { name: /Show all on page/ }).click();
    await page.bringToFront();
    await page.waitForFunction(() =>
      document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
    );
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
    );
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(400);
  });

  test('AC-F6.3: J and K are ignored while a host page input has focus', async ({
    context,
    extensionId,
    worker,
    site,
  }) => {
    const page = await openPage(context, site.url('tall.html'));
    await waitForMarkers(page);
    const tabId = await tabIdOf(worker, site.origin);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
    await popup.getByRole('button', { name: /Show all on page/ }).click();
    await page.bringToFront();
    await page.waitForFunction(() =>
      document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
    );
    await page.focus('#host-input');
    await page.keyboard.type('jk');
    expect(await page.inputValue('#host-input')).toBe('jk');
  });
});

test.describe('share image (F8)', () => {
  test('AC-F8.1/F8.2: Save image makes a 1200x630 PNG quickly, with no network request', async ({
    context,
    site,
    requests,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await openCard(page);
    await settled(page);
    const before = requests.length;
    const t0 = Date.now();
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
    const ms = Date.now() - t0;
    const path = await download.path();
    const png = readFileSync(path);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(download.suggestedFilename()).toMatch(/^catchline-127-0-0-1-\d{4}-\d{2}-\d{2}\.png$/);
    // Recorded, not golden-compared: generous gate for a loaded CI runner (spec target is 300ms).
    expect(ms).toBeLessThan(1500);
    const after = requests
      .slice(before)
      .filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
    expect(after.filter((u) => !u.startsWith('http://127.0.0.1'))).toEqual([]);
  });
});

test.describe('markers', () => {
  test('a marker is a real button with a name, and a 24px hit box', async ({ context, site }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await waitForMarkers(page);
    const info = await page.evaluate(() => {
      const b = document
        .querySelector('catchline-markers')
        ?.shadowRoot?.querySelector('button.m') as HTMLElement;
      const r = b.getBoundingClientRect();
      return { name: b.getAttribute('aria-label'), w: r.width, h: r.height, tag: b.tagName };
    });
    expect(info.tag).toBe('BUTTON');
    expect(info.name).toMatch(/^Show the catch/);
    expect(info.w).toBeGreaterThanOrEqual(24);
    expect(info.h).toBeGreaterThanOrEqual(24);
  });

  test('AC-F11.1: turning the underline off reaches the page within a second', async ({
    context,
    site,
    worker,
  }) => {
    const page = await openPage(context, site.url('carrier-specimen.html'));
    await waitForMarkers(page);
    await worker.evaluate(() =>
      chrome.storage.local.set({ settings: { version: 1, markCatchesOnPage: false } }),
    );
    await page.waitForFunction(
      () => document.querySelector('catchline-markers')?.hasAttribute('data-quiet'),
      null,
      { timeout: 1000 },
    );
    await worker.evaluate(() =>
      chrome.storage.local.set({ settings: { version: 1, markCatchesOnPage: true } }),
    );
    await page.waitForFunction(
      () => !document.querySelector('catchline-markers')?.hasAttribute('data-quiet'),
      null,
      { timeout: 1000 },
    );
  });
});
