# Catchline site: landing page and web app

Static Vite build with two pages and no framework (vanilla TypeScript, plain CSS on the DESIGN.md
tokens).

- `/` the launch landing page (docs/LANDING.md, DESIGN.md "Landing page").
- `/app/` the web app: paste promo text or page HTML, or open a bundled sample, and see every claim
  pulled up to its catch with the tether, the footnote flight, cost chips and the share-this-catch
  PNG. Installable (PWA), works offline after the first load, uploads nothing.

Both pages are separate from the extension build: this folder has its own `package.json`. Nothing
here edits the extension; it reads `../src/core` (the engine), two overlay modules (below),
`../tests/fixtures/synthetic` (the samples) and `../src/ui/base.tokens.css` (the tokens).

## Run it

```
cd site
pnpm install
pnpm dev                 # http://localhost:5173
pnpm build               # ../.output/site/ (includes sw.js, the precache service worker)
pnpm preview             # http://localhost:4173, serves ../.output/site/
pnpm test                # Vitest: engine adapter, landing vs engine, CSS token guard, privacy guards
pnpm test:e2e            # builds, then Playwright against the production build (needs Chromium)
pnpm typecheck
pnpm check:budget        # initial JS per page, no WebGL (run after build)
pnpm check:network       # no network primitive or external URL in the build (run after build)
```

Playwright browsers on this machine live in `X:\DevCache\ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`).
`node scripts/shots.mjs <dir>` captures every state at 375 / 768 / 1440, light and dark, reduced
motion and no JavaScript. `node scripts/make-assets.mjs` regenerates the PWA icons and `og.png`
(the OG card is the web app's real "Save image" output for the carrier specimen).
Screenshots from the last run are in `docs/screens/`.

## How the engine is shared

`vite.config.ts` and `tsconfig.json` define three aliases:

| Alias | Target | Used for |
|---|---|---|
| `@catchline/core` | `../src/core/index.ts` | The engine: `analyze`, matcher, extractor, rollup, card state and copy, tether geometry, flight timings, share layout, figure and highlight helpers. Never copied or re-implemented. |
| `@catchline/overlay-model` | `../src/overlay/model.ts` | `buildModels`, the catch view model the share painter takes. Pure (imports only the core). |
| `@catchline/share-render` | `../src/overlay/share-render.ts` | The extension's canvas painter for the 1200 x 630 share image, so the web app and the extension produce the same PNG. |

The two overlay aliases point at files the extension's overlay owner is still working on. If they
move or change signature, only `src/app/share.ts` needs updating.

The engine does not touch any extension API, so no shim was needed. The one adapter is
`src/engine/oracle.ts`: a `StyleOracle` for pasted pages. A `DOMParser` document has no layout, so
`getComputedStyle` is empty; the oracle reads inline `font-size`, simple rules from the page's own
`<style>` elements (no `@media`) and the HTML defaults (`<small>`, `<sup>`, size keywords). It only
looks up the page's declared sizes; whether a block is small print is still decided by the core.
`src/engine/parse.ts` turns pasted text or HTML into an inert Document, and `src/engine/reader.ts`
flattens the analysed page into readable blocks so markers and footnotes can be found again.

## Decisions

- **No WebGL.** DESIGN.md "Landing Page 3D / Immersive Plan" decided CSS and SVG only: the idea is a
  line between two points in a document, which is flat. So the bible 11.4 tiers collapse to one:
  every visitor gets the poster (server HTML, settled specimen), and there is no 3D chunk, no canvas
  and no GPU detection to run. Reduced motion keeps the settled frame (no autoplay; Replay fades
  instead of flying). No JavaScript shows the same frame without the tether. No WebGL means no
  fallback is needed. `check:budget` fails the build if WebGL code ever appears.
- **Poster first.** The LCP element is the H1. The hero specimen is static HTML with the card
  already docked; after `load` and idle, and only once it is in view, the footnote flight replays
  once. The chips and fine print in that HTML are checked against the engine by a test
  (`tests/engine.test.ts`), so the landing page cannot quote numbers the engine would not produce.
- **Closed CSP.** A meta Content-Security-Policy (added at build) has `default-src 'none'` and
  `connect-src 'none'`, so the page cannot open any connection. `style-src-attr 'unsafe-inline'` is
  there only because pasted pages carry `style` attributes that the inert parser reads.
- **Offline.** `plugins/precache.ts` writes `sw.js` into the build: cache-first over every built file, no
  `fetch`, a miss is a 404. Both pages register it after `load`.
- **Fonts** are Latin subsets of the extension's Fontsource files (`public/fonts/README.txt`), with
  metric-matched fallback faces so the swap does not shift layout.
- **Touch targets** are 44 px (buttons 44, landing CTAs 48), deviating from DESIGN.md's 32 px
  desktop button height because the web app is used on phones.

## Measured (2026-10-27, `vite preview`, chrome-devtools MCP)

| Check | Result |
|---|---|
| Trace, landing, mobile 375 px, 4x CPU, Slow 4G | LCP 690 ms (H1), CLS 0.00 |
| Trace, `/app/#sample=carrier-specimen`, same profile | LCP 867 ms, CLS 0.00 |
| Lighthouse landing, mobile and desktop | Accessibility 100, Best practices 100, SEO 91 |
| Lighthouse app, mobile | Accessibility 100, Best practices 100, SEO 91 |
| Initial JS, gzip | landing 24.4 KB, app 36.3 KB (limit 120 KB); samples are lazy, 7.3 KB total |

The SEO 91 (and Agentic browsing 67) is two audits, `robots.txt` and `llms.txt` "not valid": the
files exist and are served, but Lighthouse fetches them through the page's frame and the closed CSP
(`connect-src 'none'`) blocks that fetch. Crawlers are unaffected. Loosening the CSP to score 100
would weaken the privacy proof, so it was not done.

## Known issues and gaps

- The accuracy panel says "not yet measured": there is no `corpus/report.json` yet. When CI writes
  one, read it at build time in `index.html`'s "How it works" band (see LANDING.md).
- Store buttons do not exist (no listings), and there is no repository link: no remote exists, so the
  page says so. Set the real URLs when they exist (`#install`, `#source`).
- The landing copy describes the whole extension (overlay, Show all, popup ledger) from SPEC and
  DESIGN.md; the popup in the "checked" band is an HTML reproduction. Re-check the claims against the
  built extension when the overlay lands. The LANDING.md pre-rendered loops (beat 2 and 3 videos) are
  not made: they need the real UI.
- The web app's "reader" shows the pasted page flattened to text, up to 400 blocks. Layout, images
  and styling of the original page are not reproduced. Hidden (closed `<details>`) text is shown.
- `Show all` is not in the web app; the catch list and J/K stepping stand in for it.
- The card's tether glow pulses by stroke width (the extension spec says opacity), because the glow
  color already carries its alpha.
- Spring easings (SPRING.playful) are approximated with a cubic-bezier overshoot.
- The landing page loads the shared chunk that also holds the engine (24 KB gzip) although the
  hero only needs geometry and timings; a manual chunk split would likely trim it.
- The root `pnpm lint` also lints `site/` (ESLint strict type-checked + Prettier, both pass).
  Nothing in `site/` is covered by the root typecheck; run `pnpm typecheck` here.
- `.impeccable` design-hook ignores for "Catchline Schibsted Fallback" and "Catchline Commit
  Fallback" (metric-matched fallback `@font-face` names in `base.css`, not new fonts) could not be
  persisted because the hook CLI failed to start from a path with spaces; the findings are false
  positives.
