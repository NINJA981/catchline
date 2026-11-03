# Catchline handoff

Last updated: 2026-11-04, release preparation for v0.1.0 (branch `release/linkedin`).

## Status

Every user-facing surface in SPEC section 5 is built on the DESIGN.md tokens, in light and dark:

- **Overlay** (`src/overlay/*`, injected on demand by `src/entrypoints/overlay.content.ts` into a
  Shadow DOM root): marker hit targets, the catch card (matched, likely, many-to-one expander, no
  footnote, terms on another page, loading, error), the tether, the ghost outline, the footnote
  flight (full, short and reduced-motion versions), Show all with the scrim, fanned tethers, rail
  (bottom sheet under 900 px), J/K/Enter/Esc/? keys, and Share this catch (1200 x 630 PNG painted
  locally, `src/overlay/share-render.ts`).
- **Popup** (`src/entrypoints/popup`): rollup ledger, catch list, "Other footnotes", per-site toggle,
  and eight states (loading skeleton, empty, reference-only, success, disabled, restricted,
  permission needed, error).
- **Options** (`src/entrypoints/options`): every `Settings` field, sites turned off, accuracy ("Not
  yet measured"), shortcut table, privacy, save state and a retry on a failed save.
- **Welcome** (`src/entrypoints/welcome`): specimen page running the real overlay, labelled
  "Specimen page. Not a real offer.", three steps, Firefox permission panel. Opened once on install.
- **Site** (`site/`): landing page and the offline web app (`/app/`) on the same engine. Notes in
  `site/README.md`.

Not built: the optional plain-language line (F12) is a saved setting only; the public accuracy
corpus and scorer; Firefox runtime testing.

## What changed in the release round (2026-11-04)

Commits on `release/linkedin`, oldest first:

1. `fix round 1` (work left uncommitted by the previous session, committed unchanged): time-sliced
   scan (`src/core/steps.ts`, `analyzeSliced`), large-page scan scopes, rescan observer max wait,
   fonts through `FontFace` instead of a page `<style>`, background validation of overlay requests,
   overlay preload on marker hover, ring and tether geometry fixes, popup/options a11y fixes, web app
   status line, `scripts/check-size.mjs`.
2. QA round 1 defects: landing hero overflow at 375 px and the clipped H1 at 1440 px (the hero now
   breaks only between three short phrases), stale marker hit targets after host layout changes
   (`ResizeObserver` + font `loadingdone` in `src/overlay/markers-layer.ts`), popup chip labels now
   one line ending in an ellipsis instead of silently dropped, web app empty-submit error scrolled
   into view.
3. Docs made self-contained (no references to private planning files or machine paths);
   `docs/screenshots/qa-r1/` (16 MB of regenerable captures) removed from the tree.
4. `scripts/run-engine.mjs` (`pnpm engine <page.html>`): the engine on a saved page in Node, JSON
   out. `scripts/launch-assets.mjs`: store screenshots, social preview and hero GIF from the built
   extension.
5. OSS packaging: README rewritten, CONTRIBUTING, CODE_OF_CONDUCT (Contributor Covenant 2.1),
   SECURITY, CHANGELOG, issue and PR templates, `.github/workflows/ci.yml`. The site e2e overflow
   test now covers 320, 375, 768, 1100 and 1440 px and checks the hero phrases stay in their column.
6. Extension icons (`public/icon/*.png`, rendered by `scripts/make-icons.mjs` from the mark);
   the manifest had none before. Launch kit in `docs/launch/`.

## Checks

Last full run 2026-11-04 at commit `db65a2c` and later, every command through the shared RAM lock
(`_studio/bin/heavy.sh`), single worker:

| Check | Result |
|---|---|
| `pnpm lint` (ESLint strict type-checked + Prettier) | pass |
| `pnpm typecheck` | pass |
| `vitest run --maxWorkers=1 --no-file-parallelism` | pass: 520 tests |
| site typecheck + `vitest run` (site) | pass: 42 tests |
| `pnpm zip` / `pnpm zip:firefox` | pass (Chrome 777 kB, Firefox 778 kB, AMO sources 388 kB) |
| `web-ext lint -s .output/firefox-mv3` | 0 errors; warnings are React DOM `innerHTML` internals |
| `pnpm check:network` / `pnpm check:size` | pass (sizes below) |
| `pnpm engine tests/fixtures/synthetic/carrier-specimen.html` | 3 catches: $35 + 36 months hidden |
| `playwright test --workers=1` (extension e2e) | pass: 72 tests |
| `pnpm build:site`, site `check:budget`, `check:network` | pass (landing 24.7 kB, app 36.9 kB gzip initial JS) |
| site `playwright test --workers=1` (desktop + phone) | pass: 103 tests, incl. no overflow 320-1440 px |
| `gitleaks detect --no-banner` | no leaks (all commits) |

Bundle sizes (gzip -6, `pnpm check:size`): scanner 27.9 kB (target 22, ceiling 29), overlay
134.3 kB (target 95, ceiling 140), popup entry 137.3 kB (target 90, ceiling 142), options entry
132.1 kB (target 110, ceiling 141). All under their ceilings, all over their targets.

## Code review r1 (2026-11-04): what was fixed and what remains

The review read a snapshot from before the fix-round commit, so some findings were already handled
at HEAD. Status per finding (numbers are the review's):

| # | Finding | Status |
|---|---|---|
| 1 high | `$9.99¹` lost its marker (decimal prices not seen as prices) | Fixed, `exclusions.ts`; tests in `scan.test.ts` |
| 2 high | `<a href="#pricing">Start free*</a>` took the whole section as the footnote | Fixed, `linked.ts`: only a link whose text is the marker counts, and a headed section is never a footnote; tests in `match.test.ts` |
| 3 high | Size cap declared but not enforced; synchronous full scans | Mostly fixed by the fix round: `scanScopes` caps pages over 15,000 text nodes, scans run in 8 ms slices. **Open:** rescans are whole-page, not per mutated subtree |
| 4 med | Observer bound to a replaced `<body>`; no body on XML | Fixed: observes `<html>`, ignores Catchline's own hosts; test in `adapters.test.ts` |
| 5 med | Marker-id churn defeats the idle budget; no debounce max wait | Max wait (2 s) added in the fix round. **Open:** idle is still measured by marker ids |
| 6 med | A shared key alone ("* Required") counted as a match | Fixed, `score.ts`: a key-only candidate with fewer than 4 words is below the threshold; tests |
| 7 med | "Sign in¹", "Earn 5x¹", "$10ᵃ" dropped as units/ordinals | Fixed, `exclusions.ts`; tests |
| 8 med | Shadow DOM not traversed; SPEC listed a missing fixture | Documented as a limitation in SPEC section 6 and README; not implemented |
| 9 med | `[class*="fine"]` matched "refined", "legal" matched "paralegal"; `footnote-ref` links skipped | Fixed, `selectors.ts`, `markers.ts`; tests |
| 10 med | Repeated per-marker work (chips, tokens, block text) | **Open** |
| 11 med | `reportScan` sent on every rescan | Fixed: unchanged rollups are not resent; reset on navigation. **Open:** no scan epoch for report ordering |
| 12 low | Two overlays possible between mount and first effect | **Open** (the background now serialises injections per tab, which narrows it) |
| 13 low | "€1.299" parsed as 1.299 | **Open** |
| 14 low | `byoKey` kept in settings; unvalidated messages | Fixed: no key field is stored; message validation was added in the fix round |
| 15 low | Marker buttons not checked for occlusion; per-frame range reads | **Open** |
| 16 low | Dead exports | `BLOCK_TAGS`, `SYMBOL_CHARS` removed. **Open:** three overlapping inline-tag sets |
| 17 low | Missing tests | Added for 1, 2, 4, 6, 7, 9, 14 |

## UI review (release round)

- **Web Interface Guidelines** (Vercel, fetched 2026-11-04) checked by grep over `src/` and `site/`:
  no `transition: all`, no zoom blocking, no `autofocus`; `color-scheme` and `theme-color` set; the
  four `outline: none` rules in `src/overlay/overlay.css` are on programmatically focused
  containers (card, claim, rail) whose controls keep `:focus-visible` rings; the site uses
  `:focus:not(:focus-visible)`. No React `dangerouslySetInnerHTML` or `innerHTML` in `src/`.
- **Impeccable detector** over `src/entrypoints`, `src/ui`, `src/overlay`, `site/index.html`,
  `site/src/styles` (source scan, no rendered pass): one "nested cards" hit on the landing specimen,
  which is intentional (a framed fictional page with Catchline's card on it); three advisory
  1-2 px radii on 2 px underline bars, intentional. Audit scores (code level): accessibility 4
  (axe clean on every surface in e2e), performance 3 (bundles over target), theming 4, responsive 3
  (375 px overflow fixed, guarded by e2e from 320 to 1440 px), implementation integrity 4.
- Fixed in this round from QA round 1: landing overflow and clipped H1, stale marker hit targets,
  silently hidden popup chips, web app error below the fold, the expanded Show all entry drawn as
  two boxes (now one box with a rule).

## Accuracy: why no number is published

A trial run outside this repository scored the engine on about 66 saved third-party promo pages
(2026-10-28). It is **not** published, for four reasons: the pages are real companies' sites and
cannot be committed or shown; the labels were made by an automated evaluator, not reviewed by a
person; it ran on an uncommitted working tree, not a commit; and its last run ended in a test-worker
crash. README and Options say "not yet measured". To publish a number: build a corpus that can be
redistributed (self-authored pages that reproduce real patterns, or pages with a licence), label it
by hand, add a scorer in `tests/` that runs in CI, and publish the CI number with its corpus
description.

## How to run it

```
pnpm install
pnpm build               # .output/chrome-mv3, load unpacked at chrome://extensions
pnpm build:firefox       # .output/firefox-mv3
pnpm zip && pnpm zip:firefox
pnpm test                # unit tests
pnpm test:e2e            # builds the extension and the site, then the extension Playwright suite
pnpm test:site           # site typecheck + unit; pnpm --dir site exec playwright test for site e2e
pnpm verify              # everything, in order
pnpm engine tests/fixtures/synthetic/carrier-specimen.html
node scripts/launch-assets.mjs     # after pnpm build: docs/launch images
node scripts/screenshots.mjs all   # after pnpm build: QA captures into docs/screenshots
```

Playwright uses its default browser cache; set `PLAYWRIGHT_BROWSERS_PATH` to use another folder.

## Layout

See README.md. The rule that matters for the web app: **everything in `src/core` is pure TypeScript
with no browser or extension API**, and `src/core/index.ts` is the one entry module.
`tests/unit/guards/core-boundary.test.ts` enforces it and `eslint.config.js` adds import and global
restrictions for `src/core/**`.

| Area | Where | Notes |
|---|---|---|
| Marker scan | `src/core/scan/*` | glyphs, superscripts, phrases, exclusions (cents, code, math, bullets, ratings) |
| Matching | `src/core/match/*` | linked (href, aria) then heuristic, confidence + signals, many-to-one sentences |
| Extraction | `src/core/extract/*` | ordered regex rules per family, 6 chip kinds, structured values |
| Rollup, badge text | `src/core/rollup.ts` | hidden total sums one-time amounts only |
| UI state | `src/core/state/*` | card, popup and Show all as pure reducers/derivations |
| Settings schema | `src/core/settings.ts` | `sanitizeSettings` repairs anything read from storage |
| Browser adapters | `src/adapters`, `src/storage`, `src/messaging`, `src/dom` | thin; extension-only |
| Entrypoints | `src/entrypoints/*` | background, scanner and overlay content scripts, popup, options, welcome |
| Tokens | `src/ui/tokens.css`, `src/ui/base.tokens.css` | DESIGN.md colors, light + dark, shared with the site |

## Decisions worth knowing

- **TypeScript is pinned to 6.0.3**: `typescript-eslint` 8.72.x declares `typescript <6.1.0`.
- **The hidden-money total counts one-time amounts only.** `USD/mo`, `USD/yr` and per-unit rates are
  listed but not summed.
- **Phrase markers ("Terms apply")** match the legal section as a whole and narrow to one sentence
  only when it shares at least two words with the claim.
- **Firefox:** `strict_min_version` 140 (desktop) and 142 (Android), required by
  `data_collection_permissions`.
- **`activeTab` stays** although `<all_urls>` makes it redundant on Chrome: on Firefox host access is
  optional and `activeTab` still grants the tab after a click.
- **CSS anchor positioning is not used**; the card and tether use measured geometry (one rAF loop
  while a card is open).

## Known issues and gaps

- **Accuracy is unmeasured** on a public corpus (see above). Known extractor gaps from hand testing:
  `$10 SIM kit fee`, `Penalty APR up to 29.99%`, `Late payment fee up to $41`, `Cash advance fee is
  5%`, some "$X per extra N units" overage phrasings, "Port charges and taxes of $212".
- **Bundle sizes are over target** (see Checks). Moving `motion` and `lucide-react` out of the shared
  popup/options chunk is the way down; the scanner also carries `@wxt-dev/storage` code nothing in
  `src/` imports directly.
- **Firefox is build + `web-ext lint` only** (lint: 0 errors, warnings from React DOM's `innerHTML`
  internals). The manual checklist below has not been run.
- **AC-F10.1 (popup first paint 100 ms) and AC-F8.1 (share PNG 300 ms)** are gated loosely in e2e
  because headless Chromium on a loaded machine misses them intermittently.
- **QA round 1 item still open:** the open ring or rest underline can sit off the glyph on very
  large or superscript markers. Re-run `node scripts/screenshots.mjs all` and review.
- **The plain-language line (F12)** is a saved setting only; Options says so.
- **No store listing yet.** Copy for both stores is in `docs/launch/LAUNCH.md`.
- **Git history**: commits before `release/linkedin` carry a different author identity and AI
  co-author trailers. Rewriting history is the maintainer's decision; nothing here changed it.

### Firefox manual smoke checklist (not yet run)

1. `pnpm build:firefox`, then `about:debugging` -> Load Temporary Add-on ->
   `.output/firefox-mv3/manifest.json`.
2. Grant the host permission on the welcome page (Firefox MV3 treats it as optional).
3. Open a page with `*` footnotes: the toolbar badge shows a count; hover shows the rollup text.
4. Click a marker: the card flies up and docks; Esc closes it. Alt+Shift+C opens Show all.
5. Open the popup: shows the same rollup; on `about:` pages it shows the restricted message.
6. No network requests in the Network panel from the extension's origin.

## Testing

`docs/TESTING.md` maps every SPEC acceptance criterion to its tests, the layers, and what is not
covered. `tests/unit/guards/ac-coverage.test.ts` fails when a criterion is named by no test and is
not a listed gap. Fixtures are hand-written and synthetic; provenance in `tests/fixtures/README.md`.

## Next steps

1. A redistributable, hand-labelled accuracy corpus with a CI scorer; then tune rules against it.
2. Firefox manual smoke test; then store submissions (Chrome Web Store, AMO) with the launch kit.
3. Cut bundles toward their targets and lower the ceilings in `scripts/check-size.mjs`.
4. Re-run the visual QA captures and close the two remaining QA round 1 items.
