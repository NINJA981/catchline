import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const require = createRequire(import.meta.url);

// Self-hosted Fontsource files the content script registers at document level (ADR §5.3).
const FONT_ASSETS = [
  [
    '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2',
    'fonts/schibsted-grotesk-latin-wght-normal.woff2',
  ],
  [
    '@fontsource/commit-mono/files/commit-mono-latin-400-normal.woff2',
    'fonts/commit-mono-latin-400-normal.woff2',
  ],
  [
    '@fontsource/commit-mono/files/commit-mono-latin-500-normal.woff2',
    'fonts/commit-mono-latin-500-normal.woff2',
  ],
  ['@fontsource-variable/schibsted-grotesk/LICENSE', 'fonts/LICENSE-schibsted-grotesk.txt'],
  ['@fontsource/commit-mono/LICENSE', 'fonts/LICENSE-commit-mono.txt'],
] as const;

// ADR 0001 §3: storage, scripting, activeTab and <all_urls> for the every-page scanner.
// No remote code, no CDN fonts, no network: extension pages get a strict CSP.
export default defineConfig({
  srcDir: 'src',
  // CATCHLINE_OUT_DIR builds into another folder, so a build can run while a test run still uses .output.
  ...(process.env.CATCHLINE_OUT_DIR ? { outDir: process.env.CATCHLINE_OUT_DIR } : {}),
  modules: ['@wxt-dev/module-react'],
  // The AMO sources zip holds what a reviewer needs to rebuild the extension, not images, test
  // output or the separate site package.
  zip: {
    excludeSources: [
      'docs/**',
      'site/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '.github/**',
      '.impeccable/**',
    ],
  },
  manifestVersion: 3,
  vite: () => ({
    plugins: [tailwindcss()],
    // Vite's modulepreload polyfill calls fetch() on the extension's own chunks; extension pages
    // don't need it and the no-network check (SPEC AC-X.2) should see zero fetch calls.
    build: { modulePreload: { polyfill: false } },
  }),
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      for (const [from, to] of FONT_ASSETS) {
        files.push({ absoluteSrc: require.resolve(from), relativeDest: to });
      }
    },
  },
  manifest: ({ browser }) => ({
    name: 'Catchline',
    description:
      'Pulls the fine print up to the claim it qualifies. Runs in your browser; makes no network requests.',
    permissions: ['storage', 'scripting', 'activeTab'],
    host_permissions: ['<all_urls>'],
    // Rendered from the Catchline mark by scripts/make-icons.mjs into src/public/icon/.
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: {
      default_title: 'Catchline',
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' },
    },
    commands: {
      'show-all': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Show all catches on this page',
      },
    },
    web_accessible_resources: [
      {
        resources: ['fonts/*.woff2'],
        matches: ['<all_urls>'],
        ...(browser === 'firefox' ? {} : { use_dynamic_url: true }),
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'catchline@catchline-extension',
              // data_collection_permissions needs Firefox 140 (desktop) and 142 (Android).
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
});
