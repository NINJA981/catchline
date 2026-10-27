import { badgeOf, expect, openPage, tabIdOf, test, waitForBadge } from './extension';

test.describe('toolbar badge rollup (F7)', () => {
  test('AC-F7.1: the carrier specimen shows the count and the rollup tooltip', async ({
    context,
    worker,
    site,
  }) => {
    const url = site.url('carrier-specimen.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    const badge = await waitForBadge(worker, tabId, (b) => b.text !== '');
    expect(badge.text).toBe('3');
    expect(badge.title).toBe('3 catches: $35 + 36 months hidden');
  });

  test('AC-F7.2: reference footnotes alone leave the badge empty', async ({
    context,
    worker,
    site,
  }) => {
    const url = site.url('reference-footnotes.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    // Wait for the scan to report, then check the badge stayed empty.
    await expect
      .poll(
        () =>
          worker.evaluate(async (id) => {
            const key = `rollup:${String(id)}`;
            const all = await chrome.storage.session.get(null);
            return Object.keys(all).some((k) => k.endsWith(key));
          }, tabId),
        { timeout: 8000 },
      )
      .toBe(true);
    expect(await badgeOf(worker, tabId)).toEqual({ text: '', title: 'Catchline' });
  });

  test('AC-F7.3: the badge is per tab and clears on navigation', async ({
    context,
    worker,
    site,
  }) => {
    const carrier = site.url('carrier-specimen.html');
    const bank = site.url('bank-specimen.html');
    const first = await openPage(context, carrier);
    const second = await openPage(context, bank);
    const carrierTab = await tabIdOf(worker, carrier);
    const bankTab = await tabIdOf(worker, bank);
    expect((await waitForBadge(worker, carrierTab, (b) => b.text !== '')).text).toBe('3');
    expect((await waitForBadge(worker, bankTab, (b) => b.text !== '')).text).toBe('5');

    await first.goto(site.url('cents.html'));
    await waitForBadge(worker, carrierTab, (b) => b.text === '');
    expect((await badgeOf(worker, bankTab)).text).toBe('5');
    await second.close();
  });

  test('AC-F2.5: a footnote that arrives late is picked up without a reload', async ({
    context,
    worker,
    site,
  }) => {
    const url = site.url('lazy-legal.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    expect((await badgeOf(worker, tabId)).text).toBe('');
    const badge = await waitForBadge(worker, tabId, (b) => b.text !== '', 6000);
    expect(badge.text).toBe('1');
  });
});

test.describe('settings reach the content script (F11)', () => {
  test('a disabled site is not scanned', async ({ context, worker, site }) => {
    await worker.evaluate(async () => {
      await chrome.storage.local.set({
        settings: { version: 1, disabledHosts: ['127.0.0.1'] },
      });
    });
    const url = site.url('carrier-specimen.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    await new Promise((ok) => setTimeout(ok, 1500));
    expect(await badgeOf(worker, tabId)).toEqual({ text: '', title: 'Catchline' });
  });

  test('the badge setting off hides the count but keeps the rollup', async ({
    context,
    worker,
    site,
  }) => {
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ settings: { version: 1, badge: false } });
    });
    const url = site.url('carrier-specimen.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    await expect
      .poll(
        () =>
          worker.evaluate(async () => {
            const all = await chrome.storage.session.get(null);
            return Object.keys(all).length;
          }),
        { timeout: 8000 },
      )
      .toBeGreaterThan(0);
    expect((await badgeOf(worker, tabId)).text).toBe('');
  });
});
