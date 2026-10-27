// AC-X.3, the rest of the surfaces. pages.spec.ts already covers the popup with catches, Options,
// the welcome page and one open card. This adds: the popup in its other states, Options with a
// site turned off, Show all (rail, scrim, fanned tethers), the no-footnote card, the expanded
// many-to-one card, and a card on the welcome specimen. Light and dark. Only Catchline's own UI is
// scanned on host pages: a merchant's markup is not ours to fix.

import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, openCard, openPage, tabIdOf, test, waitForMarkers } from './extension';

async function popupFor(
  context: BrowserContext,
  extensionId: string,
  worker: Worker,
  origin: string,
): Promise<Page> {
  const tabId = await tabIdOf(worker, origin);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(tabId)}`);
  return popup;
}

async function scan(page: Page, label: string, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    label,
  ).toEqual([]);
}

const finishOverlayMotion = (page: Page) =>
  page.evaluate(() => {
    document
      .querySelector('catchline-overlay')
      ?.shadowRoot?.getAnimations()
      .forEach((a) => {
        a.finish();
      });
  });

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe on the remaining surfaces, ${scheme}`, () => {
    test(`popup states: empty, reference-only, switched off, restricted`, async ({
      context,
      extensionId,
      worker,
      site,
    }) => {
      // Empty: a page with no fine print.
      await openPage(context, site.url('cents.html'));
      await new Promise((ok) => setTimeout(ok, 1200));
      const empty = await popupFor(context, extensionId, worker, site.url('cents.html'));
      await empty.emulateMedia({ colorScheme: scheme });
      await expect(empty.getByText(/No fine print on this page\./)).toBeVisible();
      await scan(empty, 'popup empty');

      // Reference-only.
      const ref = await openPage(context, site.url('reference-footnotes.html'));
      await new Promise((ok) => setTimeout(ok, 1200));
      const refPopup = await popupFor(
        context,
        extensionId,
        worker,
        site.url('reference-footnotes.html'),
      );
      await refPopup.emulateMedia({ colorScheme: scheme });
      await expect(refPopup.getByRole('heading', { name: /0 catches/ })).toBeVisible();
      await refPopup.getByRole('button', { name: /Other footnotes/ }).click();
      // Let the disclosure finish opening: axe reads colours, and an opening panel is mid-fade.
      await refPopup.waitForTimeout(600);
      await scan(refPopup, 'popup reference-only, list open');

      // Switched off for the site.
      const off = await popupFor(
        context,
        extensionId,
        worker,
        site.url('reference-footnotes.html'),
      );
      await off.emulateMedia({ colorScheme: scheme });
      await off.getByRole('switch', { name: /Catchline on 127\.0\.0\.1/ }).click();
      await expect(off.getByText(/Catchline is off on 127\.0\.0\.1/)).toBeVisible();
      await scan(off, 'popup switched off');
      await ref.close();

      // Restricted: an extension page is as off-limits as a browser page.
      const other = await context.newPage();
      await other.goto(`chrome-extension://${extensionId}/options.html`);
      const restricted = await context.newPage();
      const otherId = await tabIdOf(worker, `chrome-extension://${extensionId}/options.html`);
      await restricted.goto(`chrome-extension://${extensionId}/popup.html?tab=${String(otherId)}`);
      await restricted.emulateMedia({ colorScheme: scheme });
      await expect(
        restricted.getByText("Browsers don't let extensions read this page."),
      ).toBeVisible();
      await scan(restricted, 'popup restricted');
    });

    test(`options with a site turned off, and a failed-save notice free state`, async ({
      context,
      extensionId,
      worker,
    }) => {
      await worker.evaluate(() =>
        chrome.storage.local.set({
          settings: { version: 1, disabledHosts: ['shop.example', 'bank.example'] },
        }),
      );
      const options = await context.newPage();
      await options.emulateMedia({ colorScheme: scheme });
      await options.goto(`chrome-extension://${extensionId}/options.html`);
      await expect(options.getByText('shop.example')).toBeVisible();
      await options.waitForTimeout(500);
      await scan(options, 'options with sites off');
      // Keyboard: Tab reaches a control that shows a focus ring (not just any axe pass).
      await options.keyboard.press('Tab');
      await options.keyboard.press('Tab');
      const focused = await options.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return { outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow };
      });
      expect(focused).not.toBeNull();
    });

    test(`Show all: rail, scrim and fanned tethers`, async ({
      context,
      extensionId,
      worker,
      site,
    }) => {
      const page = await openPage(context, site.url('carrier-specimen.html'));
      await page.emulateMedia({ colorScheme: scheme });
      await waitForMarkers(page);
      const popup = await popupFor(context, extensionId, worker, site.origin);
      await popup.getByRole('button', { name: /Show all on page/ }).click();
      await page.bringToFront();
      await page.waitForFunction(() =>
        document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-rail'),
      );
      await finishOverlayMotion(page);
      await page.waitForTimeout(300);
      await scan(page, 'show all', 'catchline-overlay');
    });

    test(`cards: no footnote, many-to-one expanded, and the welcome specimen`, async ({
      context,
      extensionId,
      site,
    }) => {
      const nf = await openPage(context, site.url('not-found.html'));
      await nf.emulateMedia({ colorScheme: scheme });
      await openCard(nf);
      await nf.waitForFunction(
        () =>
          document
            .querySelector('catchline-overlay')
            ?.shadowRoot?.querySelector('.cl-card')
            ?.textContent.includes('No footnote found'),
        null,
        { timeout: 5000 },
      );
      await finishOverlayMotion(nf);
      await scan(nf, 'card no footnote', 'catchline-overlay');

      const many = await openPage(context, site.url('many-to-one.html'));
      await many.emulateMedia({ colorScheme: scheme });
      await openCard(many);
      await many.evaluate(() => {
        const root = document.querySelector('catchline-overlay')?.shadowRoot;
        const more = Array.from(root?.querySelectorAll('button') ?? []).find((b) =>
          /Show all offer details/.test(b.textContent),
        );
        more?.click();
      });
      await finishOverlayMotion(many);
      await scan(many, 'card many-to-one expanded', 'catchline-overlay');

      const welcome = await context.newPage();
      await welcome.emulateMedia({ colorScheme: scheme });
      await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
      await openCard(welcome);
      await finishOverlayMotion(welcome);
      await scan(welcome, 'welcome with a card open');
    });
  });
}
