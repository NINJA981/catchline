import { defineConfig } from '@playwright/test';

// Runs against the production build served by `vite preview` (build first: pnpm test:e2e).
// The port is unusual on purpose: sibling projects on this machine also preview on 4173 and 4391,
// and reusing somebody else's server would test the wrong site, so a clash must fail loudly.
const PORT = 4619;

const FLOWS = ['**/app-*.spec.ts', '**/a11y.spec.ts'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  use: { baseURL: `http://localhost:${String(PORT)}/`, trace: 'retain-on-failure' },
  projects: [
    // Desktop runs every spec.
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    // Phone (375 x 812, touch) re-runs the app flows and the accessibility sweep.
    {
      name: 'phone',
      testMatch: FLOWS,
      use: {
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: false,
  },
});
