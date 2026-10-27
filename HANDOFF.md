# Catchline handoff

Last updated: 2026-10-27, end of Stage 4 (test engineer). Stage 3a/3b notes below are still accurate; the Checks table and "Testing (Stage 4)" are the current numbers.

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

## Checks (last run, 2026-10-27, Stage 4)

| Check | Result |
|---|---|
| `pnpm lint` (ESLint strict type-checked + Prettier, includes `site/`) | pass |
| `pnpm typecheck` | pass (TypeScript 6.0.3) |
| `pnpm test` (Vitest, happy-dom) | pass: 487 tests in 23 files |
| `pnpm test:site` (site typecheck + Vitest) | pass: 42 tests in 4 files |
| `pnpm build` / `pnpm build:firefox` / `pnpm check:network` | pass (Firefox `web-ext lint` was last run in Stage 3a: 0 errors, 4 React DOM `innerHTML` warnings) |
| `pnpm build:site` + `site check:budget` + `site check:network` | pass (landing 24.4 kB gz, app 36.5 kB gz initial JS, limit 120 kB) |
| `pnpm exec playwright test` (extension e2e + parity) | 68 tests pass (68 of 68 after the fixture fix; one earlier run had the AC-X.1 race, see "Testing (Stage 4)") |
| `pnpm --dir site exec playwright test` (site e2e, desktop + phone) | 99 tests pass |
| axe-core | zero violations on every surface, light and dark (list in `docs/TESTING.md`) |

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
pnpm test:e2e            # builds the extension and the site, then runs the extension Playwright suite
pnpm test:site           # site typecheck + unit; pnpm --dir site exec playwright test for site e2e
pnpm verify              # everything, in order (lint to both e2e suites)
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

## Testing (Stage 4)

Full matrix of every SPEC acceptance criterion to its tests, the layers, and what is not covered:
**`docs/TESTING.md`**. `tests/unit/guards/ac-coverage.test.ts` fails when a criterion is named by
no test and is not a listed gap.

Added in this stage: site e2e split into app flows (sample, paste, upload), offline/PWA/CSP/request
log, axe sweep and a landing smoke test, each run on a desktop project and a phone project (375 x 812,
touch); an extension axe sweep over the remaining surfaces (popup states, options, Show all rail,
no-footnote and many-to-one cards); the extension-vs-web-app parity test over all 15 synthetic
fixtures (`tests/e2e/parity.spec.ts`); the SPEC coverage guard.

Real bugs found and fixed (each with the smallest change):

1. Web app marker buttons: the accessible name did not contain the visible mark (WCAG 2.5.3 label in
   name). `aria-label` now ends with `marker <mark>` (`site/src/app/workspace.ts`).
2. Web app reader: pasted-page headings could skip levels and break the app's outline; levels are now
   nested under the result heading and never skip (`workspace.ts`).
3. Overlay card: the claim was an `h3` injected into someone else's page, which can break the host's
   heading outline; it is now a `p` that still names the dialog (`src/overlay/CardContent.tsx`).
4. Fine-print scroll region was not keyboard reachable (axe scrollable-region-focusable); it is now
   focusable with a name (`src/ui/components/catch-parts.tsx`).
5. Popup states without a count had no h1 (axe page-has-heading-one); the brand word carries it
   there (`src/entrypoints/popup/App.tsx`).
6. Landing page: the commands `pre` block scrolls, so it is now focusable and named (`site/index.html`).
7. Test infrastructure race: the e2e `requests` fixture counted the welcome tab's own chunk loads
   (the tab opens on install) as extension-origin requests when its frame URL was still blank, which
   failed AC-X.1 once in two full runs. An extension-origin load now counts only when a web page
   issued it (`tests/e2e/extension.ts`). The check still fails if a page reaches into the extension.
8. Site e2e port: the site preview ran on 4173 with `reuseExistingServer: true`; other projects on
   this machine use that port, so a run could test the wrong site. Now 4619, never reused.

Flake history, honestly: this machine is shared with other projects' browsers and servers, which is
the likely cause of the timing flakes seen in Stage 3a. Stage 4 full-suite runs: extension e2e run 1
68 of 68, run 2 67 of 68 (the AC-X.1 race above), run 3 after the fix 68 of 68. Site e2e: 99 of 99 in
both runs. Lint, typecheck and unit were run once, before the last test-fixture edit; lint and
typecheck were re-run after it (see commit).

## Next stage: start here

1. Capture the real-page corpus and write the scorer (SPEC section 11, ADR section 8); then tune
   rules and thresholds against it only.
2. `size-limit` budgets, and cut the scanner bundle below 22 kB gzip.
3. Pixel golden for the share PNG; Firefox manual smoke; F12 if wanted.
4. DESIGN.md still matches the built UI where checked (tokens, states, flight timings); the Appendix B
   unchecked boxes (poster, OG card, landing screenshots) belong to the site and capture work.

## QA round 1: design critic (2026-10-27)

Fresh captures of the extension (popup states, overlay card, Show all, options, welcome, flight and
reduced-motion strips) and the site (landing, `/app/` empty, sample and open card) at 375, 768 and 1440
px in light and dark are in `docs/screenshots/qa-r1/`. Verdict: REVISE, rubric average about 8.4
(DESIGN_BIBLE section 9), no hard fails, criterion 6 (component craft) below 8. Open design defects, in
order: the Show all expanded entry repeats its chips (`src/overlay/ShowAll.tsx`); the tether loops when
the card is placed below the marker (`tetherCurve` in `src/core/geometry.ts`, seen at 375 and 768 in the
web app); the open-marker ring becomes a tall pill on large claims (`.cl-ring` in
`src/overlay/overlay.css`); the popup skeleton does not match the loaded layout; the landing popup mock
omits the rollup line. No code was changed in this round.

### QA round 1, re-run (2026-10-28)

Re-run on a fresh build of the **current working tree**. That tree includes uncommitted fix work from
after the first run (41 modified files, plus the untracked `scripts/check-size.mjs`, `src/core/steps.ts`
and `tests/unit/steps.test.ts`). This re-run did not commit or change those files. The captures in
`docs/screenshots/qa-r1/` were overwritten. They now include `host-dark-*`, `site-app-error-*`,
`site-app-many-375-*`, `site-app-notfound-768-*` and `site-landing-reduced-1440-*`.

Verdict: **FAIL**. The rubric average is 7.2 and there is one hard fail.
- **Hard fail:** the landing page scrolls sideways at 375 px (`scrollWidth` 456, `scrollX` reaches 81).
  The uncommitted change to `site/index.html:73` wraps "next to the claim." in `.nowrap`. The same
  change also cuts off the hero H1 at 1440 px, where the specimen frame covers it ("next to the c").
- **Fixed since the first run:** the Show all chips no longer repeat, the popup skeleton now matches the
  loaded layout, and the landing popup mock now shows the rollup line.
- **Still open:** the marker hit targets go stale after the host page's layout changes, and only
  scroll and resize move them (`src/overlay/markers-layer.ts:82-83`). The popup's catch rows hide chips
  that don't fit without saying so (`.pop-row__chips` in `src/ui/pages.css:201`). The expanded Show all
  entry is drawn as two separate boxes. An empty submit in the web app shows its error below the fold.
  The open ring and the rest underline sit off the glyph on large or superscript markers.
