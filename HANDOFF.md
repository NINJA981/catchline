# Catchline handoff

Last updated: 2026-10-27, end of Stage 2 (scaffold + core).

## Status

The engine and the extension plumbing exist and are tested. **There is no designed UI yet.** The
popup is a plain-text placeholder on the DESIGN.md tokens. There is no on-page overlay, tether,
card, Show all rail, share image, options page or welcome page.

What works end to end today (verified in a real Chromium with the built extension, see "Checks"):

- The scanner content script runs on every page, finds markers, matches footnotes, extracts chips
  and reports a rollup.
- The toolbar badge shows the counted catches, per tab, with the tooltip
  `N catches: $X + Y months hidden`, and clears on navigation.
- Settings (disabled sites, badge on/off, run mode) are read from `chrome.storage.local`.
- The popup shows the rollup and every state from the DESIGN.md table as plain text.
- The Firefox MV3 build builds and passes `web-ext lint` (0 errors).

## Checks (last run)

| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm lint` (ESLint strict type-checked + Prettier) | pass |
| `pnpm test` (Vitest, happy-dom) | pass: 430 tests in 18 files; v8 coverage 94% statements overall, 98% for `src/core` top level |
| `pnpm build` (Chrome MV3) | pass |
| `pnpm build:firefox` + `web-ext lint` | 0 errors, 2 warnings (React DOM's own `innerHTML` in the popup chunk) |
| `pnpm check:network` | pass: no `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` in the build |
| `pnpm test:e2e` (Playwright, headless Chromium 156 with the built extension) | pass: 12 tests (badge rollup, per-tab, navigation clear, late footnote, disabled site, badge setting, popup, manifest permissions, zero external requests, storage contents) |

Re-run them yourself; do not trust this table past the date above. The e2e suite found one real bug
during this stage (Chromium's default extension-page body font beats `@layer base`, so the popup
body rule is now unlayered in `src/ui/app.css`); the unit suite found three (plural units lost
their weight in `tokenize`, `mo*.` at a sentence end was rejected as a wildcard, and APY was labelled
APR).

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

- **Scanner bundle is over the ADR budget:** 77.9 kB raw, about 25.7 kB gzip, against a 22 kB
  gzip target (ADR section 6). No `size-limit` check exists yet. Likely savings: drop
  `@webext-core/messaging` from the content script (use `browser.runtime.sendMessage` directly) and
  split rarely used family rules.
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
- **Overlay injection hop (ADR action item 3) and CSS anchor positioning (item 2) are not spiked.**
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

## Next stage: start here

1. Overlay (React, Shadow DOM, on-demand injection): card, tether, flight, Show all rail, using the
   state in `src/core/state/*` and the tokens in `src/ui/tokens.css`. Call `registerFonts` first.
2. Real popup, options and welcome pages from DESIGN.md.
3. Capture the real-page corpus and write the scorer (SPEC section 11, ADR section 8); then tune
   rules and thresholds against it only.
4. `size-limit` budgets, and cut the scanner bundle below 22 kB gzip.
5. Re-check DESIGN.md against the built UI and update it (Stage 1 wrote it before any UI existed).
