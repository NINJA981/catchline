import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { precachePlugin } from './plugins/precache.ts';

const here = import.meta.dirname;

// The site can open no connection of its own: scripts, styles, fonts, images, the manifest and the
// worker all come from its own origin. This is the "privacy proof" the landing page shows.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  // Pasted pages arrive with style attributes; they are parsed in an inert document and read, never shown.
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'catchline-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          '<meta charset="utf-8" />',
          `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        );
      },
    },
  };
}

// Static multi-page build: "/" is the landing page, "/app/" the installable web app.
// `base: './'` keeps every URL relative, so the build works from any path (a project subpath,
// a file server, an offline copy).
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // The one engine module the extension also imports. Never copied or re-implemented here.
      '@catchline/core': resolve(here, '../src/core/index.ts'),
      // The extension's share-image painter and its catch view model (pure DOM and canvas code).
      '@catchline/overlay-model': resolve(here, '../src/overlay/model.ts'),
      '@catchline/share-render': resolve(here, '../src/overlay/share-render.ts'),
    },
  },
  server: {
    // Samples are read from ../tests/fixtures (read-only).
    fs: { allow: [resolve(here, '..')] },
  },
  build: {
    target: 'es2023',
    // Outside site/ on purpose: the root ESLint and Prettier ignore .output/, so a build never breaks pnpm lint.
    outDir: '../.output/site',
    emptyOutDir: true,
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
        app: resolve(here, 'app/index.html'),
      },
    },
  },
  plugins: [cspPlugin(), precachePlugin()],
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
