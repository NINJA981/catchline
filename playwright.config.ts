import { defineConfig } from '@playwright/test';

// E2E runs against the built Chrome extension (.output/chrome-mv3). Build first: `pnpm build`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
