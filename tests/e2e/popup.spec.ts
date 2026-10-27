import { expect, test } from './extension';

test.describe('popup page', () => {
  test('loads on the extension origin with its own fonts and no console errors', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.getByText('Catchline', { exact: true })).toBeVisible();
    // The tab under the popup is the popup itself, which browsers treat as restricted.
    await expect(page.getByText("Browsers don't let extensions read this page.")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('uses the DESIGN.md tokens (paper background, Schibsted Grotesk)', async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    const style = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      return { font: cs.fontFamily, size: cs.fontSize, bg: cs.backgroundColor };
    });
    expect(style.font).toContain('Schibsted Grotesk');
    expect(style.size).toBe('13px');
    expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('follows prefers-color-scheme', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(light).not.toBe(dark);
  });
});

test.describe('manifest', () => {
  test('requests only the permissions the ADR lists', async ({ worker }) => {
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect([...(manifest.permissions ?? [])].sort()).toEqual(['activeTab', 'scripting', 'storage']);
    expect(manifest.host_permissions).toEqual(['<all_urls>']);
    expect(manifest.manifest_version).toBe(3);
  });
});
