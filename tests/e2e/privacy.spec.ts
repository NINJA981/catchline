import { expect, openPage, tabIdOf, test, waitForBadge } from './extension';

test.describe('privacy (SPEC §9)', () => {
  test('AC-X.1: scanning pages makes no request beyond the page itself', async ({
    context,
    worker,
    site,
    requests,
  }) => {
    const pages = [
      'carrier-specimen',
      'bank-specimen',
      'retail-specimen',
      'streaming-specimen',
      'saas-specimen',
      'travel-specimen',
      'glyphs',
      'linked',
      'hidden',
      'many-to-one',
    ];
    for (const name of pages) {
      const url = site.url(`${name}.html`);
      const page = await openPage(context, url);
      const tabId = await tabIdOf(worker, url);
      await waitForBadge(worker, tabId, (b) => b.text !== '' || name === 'hidden');
      await page.close();
    }
    const outside = requests.filter(
      (u) =>
        !u.startsWith(site.origin) &&
        !u.startsWith('chrome-extension://') &&
        !u.startsWith('data:'),
    );
    expect(outside).toEqual([]);
    // Nothing is fetched from the extension's own origin by a page script either.
    expect(
      requests.filter((u) => u.startsWith('chrome-extension://') && !u.endsWith('.woff2')),
    ).toEqual([]);
  });

  test('storage holds counts and terms, never URLs or page text', async ({
    context,
    worker,
    site,
  }) => {
    const url = site.url('carrier-specimen.html');
    await openPage(context, url);
    const tabId = await tabIdOf(worker, url);
    await waitForBadge(worker, tabId, (b) => b.text !== '');
    const dump = await worker.evaluate(async () => {
      const [local, session] = await Promise.all([
        chrome.storage.local.get(null),
        chrome.storage.session.get(null),
      ]);
      return JSON.stringify({ local, session });
    });
    expect(dump).not.toContain('127.0.0.1');
    expect(dump).not.toContain('http');
    expect(dump).not.toContain('Pixelstone');
  });
});
