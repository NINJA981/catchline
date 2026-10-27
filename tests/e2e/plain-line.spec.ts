// F12, the optional plain-language line. AC-F12.2: when the setting is on and the line cannot be
// produced, the card is exactly what it was (chips and the merchant's words) and Options says why.
// AC-F12.1 (nothing runs while the setting is off) is a unit guard: tests/unit/guards/plain-line.test.ts.

import { expect, openCard, openPage, test } from './extension';

test.describe('plain-language line (F12)', () => {
  test('AC-F12.2: turned on without a model, Options explains and the card is unchanged', async ({
    context,
    extensionId,
    worker,
    site,
    requests,
  }) => {
    // Off by default.
    const defaults = await worker.evaluate(async () => {
      const r = await chrome.storage.local.get('settings');
      return (r.settings as { plainLine?: { enabled?: boolean } } | undefined)?.plainLine?.enabled;
    });
    expect(defaults ?? false).toBe(false);

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options.html`);
    const toggle = options.getByRole('switch', { name: 'Write a one-line summary on each card' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    // The section says why there is no line: no model in this browser, or not in this version.
    await expect(
      options.getByText(/can't run an on-device model|not in this version yet/),
    ).toBeVisible();
    await options.waitForTimeout(500);
    const saved = await worker.evaluate(async () => {
      const r = await chrome.storage.local.get('settings');
      return (r.settings as { plainLine?: { enabled?: boolean } }).plainLine?.enabled;
    });
    expect(saved).toBe(true);

    // The card still shows the chips and the original footnote, and nothing was fetched for it.
    const page = await openPage(context, site.url('carrier-specimen.html'));
    const before = requests.length;
    await openCard(page);
    const text = await page.evaluate(
      () =>
        document.querySelector('catchline-overlay')?.shadowRoot?.querySelector('.cl-card')
          ?.textContent ?? '',
    );
    expect(text).toContain('$35 activation');
    expect(text).toContain('*With 36-month installment agreement');
    expect(text.toLowerCase()).not.toContain('summary');
    // Packaged fonts load from the extension's own files; that is not a network request.
    const outside = requests
      .slice(before)
      .filter((u) => !u.startsWith(site.origin) && !/^chrome-extension:\/\/[^/]+\/fonts\//.test(u));
    expect(outside).toEqual([]);
  });
});
