# Catchline handoff

Last updated: 2026-10-27, end of Stage 3a (product UI).

## Status

Every user-facing surface in SPEC section 5 is built on the DESIGN.md tokens, in light and dark:

- **Overlay** (`src/overlay/*`, injected on demand by `src/entrypoints/overlay.content.ts` inside a
  Shadow DOM root): marker hit targets, the catch card (matched, likely, many-to-one expander, no
  footnote, terms on another page, loading, error), the tether, the ghost outline, the footnote
  flight (full, short and reduced-motion versions), Show all with the scrim, fanned tethers, rail
  (bottom sheet under 900 px), J/K/Enter/Esc/? keys with pressable keycaps, and Share this catch
  (1200 x 630 PNG painted locally, `src/overlay/share-render.ts`).
- **Popup** (`src/entrypoints/popup`): rollup ledger, catch list, "Other footnotes", per-site toggle, and all
  eight states (loading skeleton, empty, reference-only, success, disabled, restricted, permission
  needed, error).
- **Options** (`src/entrypoints/options`): every `Settings` field, sites turned off, accuracy ("Not yet
  measured"), shortcut table, privacy, save-state text and a retry on a failed save.
- **Welcome** (`src/entrypoints/welcome`): specimen page running the real overlay, labelled "Specimen
  page. Not a real offer.", three steps, Firefox permission panel. Opened once on install.
- Shared UI: `src/ui/components/*`, `src/ui/components.css`, `src/ui/pages.css`,
  `src/ui/base.tokens.css` (tokens shared with the site), `src/overlay/overlay.css`.

Not built (see "Known issues"): the optional plain-language line (F12) is only a saved setting that
Options explains is not in this version; the real-page corpus and scorer; Firefox runtime testing.

## Checks (last run, 2026-10-27)

| Check | Result |
|---|---|
| `pnpm typecheck` | pass (TypeScript 6.0.3) |
| `pnpm lint` (ESLint strict type-checked + Prettier) | pass |
| `pnpm test` (Vitest, happy-dom) | pass: 473 tests in 20 files |
| `pnpm build` (Chrome MV3) | pass |
| `pnpm build:firefox` + `web-ext lint` | 0 errors, 0 notices, 4 warnings (all `UNSAFE_VAR_ASSIGNMENT` from React DOM's own `innerHTML` in the settings chunk and overlay bundle) |
| `pnpm check:network` | pass |
| `pnpm test:e2e` (Playwright, headless Chromium, built extension) | 38 tests; 37 to 38 pass per run. Two timing flakes were seen once each and hardened: the popup first-paint gate and the cold-start badge wait (see below). Run again before trusting it. |
| axe-core (AC-X.3) on popup, options, welcome and an open card | zero violations, light and dark (part of the e2e run) |

Bundle sizes (gzip -6): scanner content script 27.7 kB (ADR budget 22 kB, still over), overlay
content script 136 kB (injected on demand only), no size-limit check yet.

## Visual QA (DESIGN_BIBLE section 9)

`node scripts/screenshots.mjs [overlay|popup|states|pages|strip|all]` (build first) writes to
`docs/screenshots/`: options and welcome at 375/768/1440 light and dark (plus the welcome card
open), overlay card, Show all (and expanded) at 375/768/1440 light and dark, many-to-one and
not-found card states, all eight popup states light and dark at real size, the interaction state
sheet (`states-popup-*.png`: rest, hover, focus-visible, pressed), the signature flight frame strip
(`strip-flight.png`, 13 frames, plus `strip-flight/`) and the reduced-motion strip
(`strip-reduced-motion.png`, 10 frames). The strips seek paused Web Animations, so they are
deterministic.

Self-scored against section 9.2, on the screenshots above: identity 9, typography 9, color 9,
layout 9, hierarchy and content 9, component craft 9, interaction states 9, motion 9, system states 9,
responsive 9; average about 9.0, no hard fail found (axe clean, focus rings visible in the state
sheet, no horizontal scroll at 375, reduced motion honoured). This is the builder's own
judgment, not an independent critic review. Honest caveats that keep it from being higher:
the host fixtures are unstyled browser-default pages, so the overlay screenshots sit on Times New
Roman (the welcome specimen shows the overlay on a styled page); no Lighthouse run for the
extension pages; the disabled and loading primary-button states are shown for the popup only.

## How to run it

```
pnpm install
pnpm dev                 # Chrome with HMR (WXT opens a browser)
pnpm build               # .output/chrome-mv3, load unpacked at chrome://extensions
pnpm build:firefox       # .output/firefox-mv3
pnpm test                # unit tests
pnpm test:e2e            # builds, then runs Playwright (needs: pnpm exec playwright install chromium)
pnpm lint && pnpm typecheck
pnpm check:network       # after a build
```

This machine keeps browsers in `X:\DevCache\ms-playwright` (`PLAYWRIGHT_BROWSERS_PATH`).

## Layout

See README.md. The rule that matters for the web app (`site/`): **everything in `src/core` is pure
TypeScript with no browser or extension API**, and `src/core/index.ts` is the one entry module.
`tests/unit/guards/core-boundary.test.ts` enforces it (no `chrome.*`, no globals, no network, no
imports from outside `src/core`, and the text-only functions run in a Node environment with no DOM).
`eslint.config.js` adds import and global restrictions for `src/core/**`.

| Area | Where | Notes |
|---|---|---|
| Marker scan | `src/core/scan/*` | glyphs, superscripts, phrases, exclusions (cents, code, math, bullets, ratings) |
| Matching | `src/core/match/*` | linked (href, aria) then heuristic, confidence + signals, many-to-one sentences |
| Extraction | `src/core/extract/*` | ordered regex rules per family, 6 chip kinds, structured values |
| Rollup, badge text | `src/core/rollup.ts` | hidden total sums one-time amounts only |
| UI state | `src/core/state/*` | card, popup and Show all as pure reducers/derivations |
| Settings schema | `src/core/settings.ts` | `sanitizeSettings` repairs anything read from storage |
| Browser adapters | `src/adapters`, `src/storage`, `src/messaging`, `src/dom` | thin; extension-only |
| Entrypoints | `src/entrypoints/*` | `background`, `scanner.content`, `popup` |
| Tokens | `src/ui/tokens.css` | DESIGN.md colors verbatim, Tailwind v4 `@theme inline`, light + dark |

Fonts are Schibsted Grotesk (variable) and Commit Mono through Fontsource, bundled for extension
pages and copied to `fonts/` for the content script's document-level `@font-face` (ADR section 5.3;
`src/dom/fonts.ts` is written and tested but nothing calls it until the overlay exists).

## Fixtures

All fixtures are hand-written and synthetic; provenance is in `tests/fixtures/README.md`. The 30
real-page corpus (SPEC section 11) does **not** exist. Extractor table cases (about 15 per family,
SPEC AC-F4.1) are inline in `tests/unit/extract/*.test.ts`.

## Decisions made in Stage 2

- **TypeScript is pinned to 6.0.3, not 7.0.2.** `typescript-eslint` 8.72.x declares
  `typescript <6.1.0`. Recorded in ADR 0001 (stack table and action item 1).
- **The hidden-money total counts one-time amounts only.** Chip units carry the recurrence:
  `USD` is one-time; `USD/mo`, `USD/yr` and `USD/unit` (overage rates) are listed but not summed. A
  bank page therefore reads `5 catches: 15 months hidden` rather than adding a $12/month fee and a
  $95 annual fee into one "hidden" number.
- **Phrase markers ("Terms apply") match the legal section as a whole** and are narrowed to one
  sentence only when that sentence shares at least two words with the claim and clears the overlap
  threshold (otherwise the whole section is shown). The phrase words themselves are ignored.
- **Firefox:** `strict_min_version` is 140 (desktop) and 142 (Android) because
  `data_collection_permissions` needs them.
- **Two markers in one short block share the same claim text** (the whole block). Matching still
  works by key; the overlay will need the marker position, which `Marker.anchor` carries.

## Known issues and gaps

- **Scanner bundle is over the ADR budget:** 84 kB raw, 27.7 kB gzip (`gzip -6`), against a 22 kB
  gzip target (ADR section 6). `@webext-core/messaging` is already gone; the overlay bridge and
  settings code grew it. No `size-limit` check exists yet. Likely savings: split rarely used family
  rules and lazy-load the marker layer.
- **Accuracy is unmeasured on real pages.** The synthetic fixtures prove code paths. The extractor
  has known gaps (for example `$10 SIM kit fee`, `Penalty APR up to 29.99%`, `Late payment fee up
  to $41`, `Cash advance fee is 5%`, some "$X per extra N units" overage phrasings, and
  "Port charges and taxes of $212"). Fix them against the real corpus, not by guessing.
- **`Marker.claimText` for pages with several markers in one block** is the whole block (see above).
- **No `size-limit`, no `check-tokens` with culori, no `oxlint`.** ESLint (strict type-checked) is
  the linter; `tests/unit/guards/tokens.test.ts` covers token drift without culori. The ADR's
  accent distance (delta E) check is not implemented.
- **Popup state depends on a tab URL it reads itself**, so the popup cannot yet be exercised against
  a specific page in e2e (it sees its own tab). The view logic is covered by unit tests
  (`state.test.ts`, `popup.test.tsx`).
- **Firefox is build + lint only.** Playwright cannot load Firefox extensions; the manual smoke
  checklist below has not been run.
- **CSS anchor positioning is not used.** The card and tether use the measured-geometry path only
  (one rAF loop while a card is open, read all rects then write all transforms). The injection hop
  (executeScript from the background) is implemented and covered by e2e.
- **AC-F8.1 is not golden-compared:** the e2e test checks the PNG is 1200 x 630 and made without a
  network request, with a loose time gate; there is no pixel golden yet.
- **AC-F10.1 (first paint 100 ms) is not asserted strictly:** measured 108 to 140 ms from navigation
  start when run alone, once 552 ms on a loaded runner; the test gate is 1000 ms.
- **E2E flakes:** the badge tests can miss their wait on a cold first browser launch (wait is now
  15 s); re-run once before suspecting a regression.
- **F12 plain-language line is a saved setting only.** Options says so; AC-F12.1 holds because no
  built-in AI API is called anywhere.
- **No Lighthouse run for the extension pages;** axe is the accessibility evidence.
- **`web-ext lint` warnings:** two `UNSAFE_VAR_ASSIGNMENT` from React DOM internals in the popup
  chunk.
- **TypeScript 7.0.2 with WXT is untried.** The blocker found is `typescript-eslint`, not WXT.
- Patch releases newer than the pins exist (`wxt` 0.21.5, `vite` 8.3.5, `happy-dom` 21.0.4 on
  2026-10-27). They were not taken to keep the lockfile stable.
- `PRODUCT.md` and `.impeccable/` are leftovers from Stage 1 (`.impeccable/questions/` is untracked).

### Firefox manual smoke checklist (not yet run)

1. `pnpm build:firefox`, then `about:debugging` -> Load Temporary Add-on -> `.output/firefox-mv3/manifest.json`.
2. Grant the host permission when prompted (Firefox MV3 treats it as optional).
3. Open a page with `*` footnotes: the toolbar badge shows a count; hover shows the rollup text.
4. Open the popup: shows the same rollup; on `about:` pages it shows the restricted message.
5. No network requests in the Network panel from the extension's origin.

## Site: landing page and web app (Stage 3b, `site/`)

A separate package (`site/package.json`, its own `pnpm install`). Full notes, decisions, measured
numbers and known issues are in **`site/README.md`**; the testable criteria are SPEC section 13.

- `/` landing page, `/app/` installable offline web app (paste text or HTML, or open a sample; the
  engine, tether, flight, cost chips and share PNG). Run: `cd site && pnpm install && pnpm dev`.
  Checks: `pnpm test`, `pnpm test:e2e`, `pnpm check:budget`, `pnpm check:network` (all pass).
- **Engine reuse:** the site imports `src/core/index.ts` through the `@catchline/core` alias. No
  extension API is reachable from the core, so no shim was needed; the only adapter is
  `site/src/engine/oracle.ts` (a `StyleOracle` for pasted pages, which have no layout). The site also
  imports `src/overlay/model.ts` and `src/overlay/share-render.ts` (aliases `@catchline/overlay-model`,
  `@catchline/share-render`) so the web app produces the extension's share PNG. If the overlay owner
  moves or changes them, update `site/src/app/share.ts` only.
- **Build output** goes to `.output/site/` (not `site/dist`) so the root ESLint and Prettier, which
  ignore `.output/`, never see generated files. The root `pnpm lint` does lint `site/` sources.
- **No WebGL** on the landing page (DESIGN.md decision); the budget script fails the build if it
  appears. Measured on a throttled mobile profile: landing LCP 690 ms, app LCP 867 ms, CLS 0.
- Open: accuracy panel says "not yet measured" (no `corpus/report.json`), no store or repository
  links exist yet, landing copy describes the full extension and should be re-checked once the
  overlay is built.

## Next stage: start here

1. Capture the real-page corpus and write the scorer (SPEC section 11, ADR section 8); then tune
   rules and thresholds against it only.
2. `size-limit` budgets, and cut the scanner bundle below 22 kB gzip.
3. Pixel golden for the share PNG; Firefox manual smoke; F12 if wanted.
4. DESIGN.md still matches the built UI where checked (tokens, states, flight timings); the Appendix B
   unchecked boxes (poster, OG card, landing screenshots) belong to the site and capture work.
