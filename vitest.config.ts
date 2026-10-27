import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/dom/**', 'src/storage/**', 'src/state/**'],
      reporter: ['text', 'html'],
    },
  },
});
