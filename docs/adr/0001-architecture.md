# ADR-0001: Catchline architecture

**Status:** Accepted (Stage 1, architect)
**Date:** 2026-10-20
**Deciders:** Catchline maintainers (studio build pipeline: architect, builder, design QA)

## Context

Catchline is a browser extension that finds footnote markers (`*`, `†`, `‡`, `§`, `¶`, `<sup>`
digits, Unicode superscripts, "Terms apply" phrases) on any page, matches each to its footnote
(mostly unlinked, often hidden in accordions far down the page), extracts the conditions into chips,
and draws a tether from the claim to a card. Scope is fixed by `_studio/picks.json` and `SPEC.md`.

Forces:

- **It runs on every page.** The badge rollup (SPEC 4.2) needs a scan on every page load, so the
  per-page cost (script size, main-thread time, memory) matters more than anything else.
- **Host pages are hostile.** Arbitrary CSS, `rem` overrides, sticky headers, lazy content, SPA
  navigation, framework re-renders. The overlay must never reflow the page and must look identical
  everywhere.
- **No network, no backend, no telemetry.** Everything is deterministic and local.
- **Accuracy is the product risk.** Matching on real carrier and bank pages decides whether people
  trust it, so the test corpus is architecture, not an afterthought.
- **Studio stack:** React + Tailwind v4 + Radix + Motion (Design Bible). Chrome MV3 first, Firefox
  build too, via WXT.
- **Team:** one builder agent per stage; simple, well-documented tools beat clever ones.

## Decision

1. **WXT** builds the extension for Chrome MV3 and Firefox MV3 from one codebase.
2. **Split content scripts.** A small vanilla-TypeScript **scanner** (no React) runs on every page
   at `document_idle`. A React **overlay** bundle is injected on demand (first card open, Show all,
   share) with `browser.scripting.executeScript`. The every-page cost stays near 20 KB gzipped.
3. **Pure core.** Scanning, matching, sentence selection, extraction and rollup live in `src/core`
   as DOM-in, data-out functions with an injectable `StyleOracle`, so the same code runs in the
   content script, in Vitest, in the Playwright corpus scorer and on the landing page.
4. **Positioning:** CSS anchor positioning for the card where the browser supports it and the anchor
   can be referenced; a measured-geometry tracker for the tether path (always) and as the card
   fallback (section 5.4).
5. **Shadow DOM** for every pixel Catchline draws on a page; px-based tokens inside it; fonts
   registered at document level under private family names.
6. **Corpus-gated CI.** A fixture corpus scored in real Chromium on every push, with published
   precision and recall.
7. **No LLM in the core.** The optional plain-language line (F12) uses Chrome's on-device model
   when present; a BYO-key cloud provider is specified but not scheduled.

## Options considered

### Extension framework

| Dimension | WXT 0.21.4 (chosen) | Plasmo | CRXJS + Vite | Hand-rolled Vite + manifest |
|---|---|---|---|---|
| Complexity | Low: file-based entrypoints, typed manifest | Low | Medium | High |
| Firefox build | First class (`-b firefox`) | Partial | Weak | Manual |
| Shadow-root UI helper | `createShadowRootUi` built in | Yes | No | No |
| Maintenance (Oct 2026) | Active; 0.21.4 published 2026-08-11 | Slower release cadence | Sporadic | n/a |
| Studio familiarity | Mandated by the brief | None | None | None |

**Pros (WXT):** one config for both browsers, typed `storage.defineItem` with versioned migrations,
`createShadowRootUi` with `cssInjectionMode: 'ui'`, `wxt zip` for both stores.
**Cons:** pre-1.0; minor versions can break. Mitigated by exact pins and a lockfile.

### Overlay rendering

| Dimension | A. React in one every-page content script | B. Vanilla scanner + lazy React overlay (chosen) | C. Vanilla everything (Motion mini `animate`) |
|---|---|---|---|
| Every-page JS | ~75-90 KB gz (React + app) on every page | ~20 KB gz scanner; React only after a user action | ~25 KB gz |
| Studio consistency | Full | Full in all UI surfaces | Overlay diverges from popup/options |
| Complexity | Low | Medium: two scripts, one message hop | Medium: hand-built components, focus traps |
| First-open latency | 0 ms | One `executeScript` hop (target ≤ 80 ms; measured in e2e) | 0 ms |

**Trade-off:** B pays a one-time injection hop when the user first opens a card on a page, in
exchange for not parsing React on every page anyone ever visits. The signature flight (300+ ms)
hides the hop. If e2e measures the hop above 80 ms on the CI runner, fall back to C for the card
only (the tether is already vanilla SVG).

### Card positioning

| Dimension | CSS anchor positioning | Measured geometry (rAF tracker) |
|---|---|---|
| Scroll smoothness | Compositor-driven, no jank | One frame behind on fast scroll unless rAF-synced |
| Cross-tree anchors | Needs `anchor-name` on the host claim element (inline style write, no layout effect) and a tree-scoped lookup from the shadow tree | Works anywhere |
| Browser support | Chromium yes; Firefox to be verified at build time | Everywhere |
| Robustness to frameworks | Inline style can be wiped by a re-render | Unaffected |

**Decision:** picks.json names CSS anchor positioning, so it is the primary card path where a spike
(action item 2) proves it works from inside our shadow root. The tether path needs live endpoint
geometry anyway, so the rAF tracker exists in every case and doubles as the card fallback. The
overlay detects support with `CSS.supports('anchor-name: --a')` plus a runtime self-test (position
a probe, compare rects) and picks a path per page.

## 1. Stack (versions pinned exactly; checked with `npm view <pkg> version` on 2026-10-20)

Runtime dependencies:

| Package | Version | Use |
|---|---|---|
| `react` | 19.3.1 | Popup, options, welcome, overlay, landing |
| `react-dom` | 19.3.1 | |
| `motion` | 14.4.0 | UI motion (`motion/react`), `MotionConfig reducedMotion="user"` |
| `radix-ui` | 1.8.1 | Popover/Tooltip/Switch/Collapsible/Dialog primitives (portals pointed into the shadow root) |
| `lucide-react` | 1.60.0 | One icon set, 16 px, 1.5 px stroke |
| `@fontsource-variable/schibsted-grotesk` | 5.3.0 | UI face (OFL-1.1, variable 400-900), subset and bundled |
| `@fontsource/commit-mono` | 5.3.0 | Mono for numbers in the ledger, keycaps, IDs (OFL-1.1, static 400/500) |
| `@webext-core/messaging` | 4.0.0 | Typed messages between scanner, overlay, background, popup |

Build and test (devDependencies):

| Package | Version | Note |
|---|---|---|
| `wxt` | 0.21.4 | Peer: `vite ^6.3.4 \|\| ^7 \|\| ^8`, `typescript >=5.4`, `web-ext >=9.2.0`, Node >= 22 |
| `@wxt-dev/module-react` | 1.2.2 | Brings `@vitejs/plugin-react` |
| `vite` | 8.3.4 | Pinned explicitly to satisfy peers for WXT, Tailwind and the landing build |
| `@vitejs/plugin-react` | 6.1.2 | Peer `vite ^8` |
| `tailwindcss` | 4.3.3 | Tokens via `@theme inline` (DESIGN.md) |
| `@tailwindcss/vite` | 4.3.3 | |
| `typescript` | 6.0.3 | **Pinned to 6.0.3 at Stage 2** (npm `latest` is 7.0.2). `typescript-eslint` 8.72.x declares `typescript >=4.8.4 <6.1.0`, so 7.x would break type-aware linting; revisit when typescript-eslint supports 7 |
| `web-ext` | 10.8.0 | Firefox lint and run |
| `vitest` | 5.0.5 | Unit tests |
| `@vitest/coverage-v8` | 5.0.5 | |
| `happy-dom` | 21.0.3 | Unit-test DOM (no layout; layout-dependent signals go through `StyleOracle`) |
| `@testing-library/react` | 16.3.3 | Component tests |
| `@playwright/test` | 1.64.1 | E2E with the built extension, corpus scorer, demo capture |
| `culori` | 4.0.2 | CI check: accent ΔE_OK ≥ 0.06 from the bible §4.4 blocklist; contrast checks |
| `size-limit` | 14.2.0 | Bundle budgets (section 6) |
| `@size-limit/preset-small-lib` | 14.2.0 | |
| `oxlint` | 1.89.0 | Lint (fast); custom rules via grep scripts for no-network and no-raw-palette |
| `prettier` | 3.9.10 | Format |
| `@types/react` / `@types/react-dom` | 19.3.0 / 19.3.0 | |
| `@types/node` | 24.19.2 | Matches Node 24 |
| `@axe-core/playwright` | 4.14.0 | Accessibility assertions in e2e |

Optional, not installed in MVP (F12 BYO-key path only): `@anthropic-ai/sdk` 0.135.0.

Package manager: pnpm with a committed `pnpm-lock.yaml`. `package.json` uses exact versions (no
`^`/`~`), and `.npmrc` sets `save-exact=true`.

## 2. Module layout

```
catchline/
  wxt.config.ts            manifest, permissions, commands, browser targets, srcDir: 'src'
  package.json             exact pins; scripts: dev, dev:firefox, build, build:firefox, zip, test, e2e, corpus, corpus:readme, site:dev, site:build, size
  src/
    core/                  PURE: no browser.* APIs, no globals; takes Document + StyleOracle
      types.ts             Marker, FootnoteBlock, Match, Chip, Catch, TabRollup (SPEC §7)
      scan/markers.ts      TreeWalker over text nodes + <sup>; glyph and phrase detection
      scan/exclusions.ts   cents superscripts, math, code, ™®©, bullets, ratings
      scan/claim.ts        claim text: nearest sentence / heading / price block around the marker
      match/linked.ts      stage A: href, aria-describedby, aria-details
      match/candidates.ts  stage B: legal/footer/disclaimer containers, small-font blocks, details/hidden text
      match/score.ts       confidence model + signals
      match/sentence.ts    many-to-one sentence selection by token overlap (F3)
      extract/index.ts     chip extraction entry; dedupe; ordering
      extract/rules/       common.ts carrier.ts bank.ts retail.ts streaming.ts saas.ts travel.ts
      family.ts            page family guess (carrier/bank/...) from vocabulary, used to weight rules
      rollup.ts            TabRollup from Catch[]; badge text; tooltip text
    dom/
      style-oracle.ts      real getComputedStyle-backed oracle (content script, corpus scorer)
      observe.ts           MutationObserver with debounce and budget; SPA navigation hooks
      geometry.ts          rAF rect tracker, sticky-header detection, anchor-positioning self-test
      fonts.ts             registers @font-face at document level with private family names
    entrypoints/
      background.ts        badge + tooltip per tab, commands, overlay injection, storage.session rollups
      scanner.content.ts   every page, document_idle: scan, send rollup, draw marker hit targets (vanilla shadow root)
      overlay.content/     NOT auto-registered (registration: 'runtime'); injected on demand
        index.tsx          createShadowRootUi mount, PortalTarget context
        Card.tsx Tether.tsx Flight.ts ShowAll.tsx Rail.tsx Chip.tsx
      popup/               index.html main.tsx App.tsx
      options/             index.html main.tsx App.tsx
      welcome/             index.html main.tsx (unlisted page; opened on install)
    features/
      share/render-card.ts OffscreenCanvas 2D drawing of the 1200x630 share card
      plain-line/on-device.ts   Chrome built-in AI adapter (feature-detected)
      plain-line/byo-key.ts     ONLY file allowed to call fetch (CI-enforced); not wired in MVP
    storage/
      settings.ts          storage.defineItem('local:settings', { version: 1, fallback, migrations })
      rollup.ts            session-scoped per-tab rollup
    messaging/protocol.ts  typed message map
    ui/
      tokens.css           DESIGN.md tokens as CSS custom properties, light + dark, px-based for shadow roots
      components/          Button, IconButton, Chip, Keycap, Toggle, Ledger, Skeleton, Toast
  corpus/
    fixtures/real/<family>/<slug>/{page.html, meta.json, expected.json}
    fixtures/synthetic/<name>/{page.html, expected.json}
    capture.ts             Playwright capture + reduction (dev-time only)
    score.ts               loads each page in Chromium, runs core, compares to expected.json
    report.json            generated; committed so the README and Options can read it
  site/                    landing page (Vite + React, static); imports src/core and overlay components
  tests/
    unit/                  Vitest + happy-dom (core logic, extractor tables, components)
    e2e/                   Playwright with the built Chrome extension
  scripts/                 check-network.mjs, check-tokens.mjs, readme-corpus.mjs, capture-demo.mjs
  docs/adr/  docs/LANDING.md
```

## 3. Runtime architecture

```
 page load ──> scanner.content.ts (every page, idle)
                 │ core.scan(document, oracle) -> Catch[]      (≤ 50 ms budget, chunked)
                 │ core.rollup(catches) -> TabRollup
                 │ draws marker hit targets in a tiny shadow root (if setting on)
                 ├──msg: rollup ──> background.ts ── setBadgeText / setTitle (per tab)
                 │                                  └─ storage.session[tabId] = rollup
                 │ MutationObserver (debounced 300 ms) re-scans changed subtrees
                 │
 user clicks marker / command / popup "Show all"
                 ├──msg: openOverlay(markerId | 'all') ──> background.ts
                 │        background: scripting.executeScript(overlay.js) once per page
                 └──> overlay.content (React in shadow root, z 2147483647)
                        receives Catch[] from scanner via window-scoped message channel
                        Card + Tether (SVG, fixed full-viewport layer) + Flight
                        geometry tracker keeps endpoints live on scroll/resize

 popup opens ──> reads storage.session[tabId] synchronously-first ──> renders ledger
              └─> msg to scanner for live list; "Show all" -> openOverlay('all')
```

- **Permissions (Chrome):** `storage`, `scripting`, `activeTab`, host permission `<all_urls>` for
  the every-page scanner (required for the badge rollup; the store listing explains why).
  `activeTab` is redundant on Chrome while `<all_urls>` is granted. It stays for Firefox, where host
  permissions are optional: after a user gesture (toolbar click, shortcut) it grants the tab
  temporarily even if the user never accepted the host permission. `runOn: 'on-click'` (Options)
  unregisters the scanner and uses `activeTab` only. `commands` for
  `_execute_action` and `show-all` (Alt+Shift+C suggested).
- **Firefox:** MV3 build (`manifestVersion: 3` for both targets in `wxt.config.ts`),
  `browser_specific_settings.gecko.id` set. Host permissions are optional on Firefox MV3, so the
  welcome page requests them and the popup shows a "permission needed" state until granted.
- **SPA navigation:** the scanner listens to `wxt:locationchange` (WXT content-script context) and
  re-scans; the background clears the badge on `tabs.onUpdated` with `status: 'loading'`.
- **Scan budget (implemented in fix round 1):** the scan is a set of generators (`src/core/steps.ts`)
  that `yield` between small units of work; `analyzeSliced` hands the thread back every 8 ms
  (`scheduler.yield`, else `setTimeout 0`) and a second request that arrives mid-scan is coalesced
  into one more pass. The observer has a 2 s max wait so a page that mutates faster than the
  300 ms debounce is still rescanned. Original text: `requestIdleCallback` chunks of ≤ 8 ms; whole-scan soft cap 50 ms median on corpus
  pages; observers stop growing after 200 mutation batches with no new markers (re-armed on
  navigation). Pages over 15,000 text nodes scan only `main`, `footer` and legal containers.
- **Restricted pages** (`chrome://`, store pages, PDF viewer): no injection; popup shows the
  restricted state.

## 4. Matching design (summary)

1. **Scan** text nodes with a `TreeWalker` (skipping excluded subtrees) and `<sup>` elements; emit
   markers with claim text. Cents rule: a `<sup>` of 1-2 digits whose previous text ends in a digit
   or currency amount is excluded.
2. **Stage A (linked):** follow `href="#..."`, `aria-describedby`, `aria-details`. Confidence 1.0.
3. **Stage B (heuristic):** collect candidate blocks once per scan: elements in
   `footer, [class*=legal i], [class*=disclaimer i], [class*=terms i], [id*=terms i],
   [class*=fine i], [class*=disclosure i], [class*=offer-details i], details, small` plus blocks whose
   computed font-size ≤ 0.85 × body. Search bottom-up for a block that **starts** with the marker
   glyph (or the digit for superscripts). Score from signals: same glyph at block start, container
   class, small font, document position below the claim, single vs multiple candidates, token
   overlap between claim and footnote.
4. **Many-to-one:** if one footnote matches more than 2 claims, split it into sentences and pick the
   best token-overlap sentence per claim (numbers and units weighted 2x); keep the whole block behind
   an expander.
5. **Not found:** if the best score < 0.45, `footnoteId: null`. If the claim's nearest link points to
   `/terms`, `/legal`, `/disclosures` or similar, set `external` for the link chip.
6. **Extract** chips from the chosen sentence (or block) with ordered, family-weighted rules; each chip
   keeps its text span so the card can highlight it inside the raw text.

The thresholds above are starting values; they are tuned only against the corpus, and any change
must move the published numbers (section 8).

## 5. UI runtime details

### 5.1 Shadow DOM isolation
`createShadowRootUi` with `cssInjectionMode: 'ui'` and WXT's default `all: initial` reset. Radix
portals target the shadow root's `<body>` through a `PortalTarget` context (WXT FAQ pattern).

### 5.2 Units
WXT's reset does not cover `rem`, and host pages change the root font size. All Catchline UI CSS
inside shadow roots uses px: Tailwind's `--spacing` is set to `4px` and every type token is in px
(DESIGN.md). A CI grep fails on `rem` in overlay CSS.

### 5.3 Fonts
Chromium ignores `@font-face` declared inside shadow-root stylesheets. `dom/fonts.ts` adds
`FontFace` objects to the host document's `document.fonts` for private family names
(`"Catchline Schibsted"`, `"Catchline Commit"`), loaded from `browser.runtime.getURL()` woff2 files
listed in `web_accessible_resources` (matches `<all_urls>`, `use_dynamic_url: true` on Chrome). This
adds no rules that select host elements. **Why not a `<style>` element (changed in fix round 1):**
CSS text in the page's `<head>` is readable by any page script, and on Firefox the URL contains a
per-install UUID (`moz-extension://<uuid>/...`), a stable identifier that would let a site recognise
the user. With `FontFace` the URL never appears in page-readable text (the font request itself is
still visible to the page's CSP reporting, the same exposure as any `web_accessible_resources` load).
The faces are removed when the overlay is destroyed. A `<style>` element is the fallback only where
`FontFace` is missing, and it is removed on destroy too. Subset woff2 files: Latin + punctuation + `† ‡ § ¶ ¹²³` and
currency symbols, target ≤ 40 KB each.

### 5.4 Geometry
`geometry.ts` tracks claim, marker and card rects with one rAF loop that runs only while an overlay
is open, reading all rects first and writing all transforms after (no layout thrash). The tether
path is recomputed from those rects every frame during scroll. Sticky headers are detected (fixed or
sticky elements at the top with height ≥ 40 px) so cards avoid sitting under them.

### 5.5 Signature flight
CSS motion path (`offset-path: path(...)`, animated `offset-distance`) plus `transform: scale()` on
a cloned footnote, driven by WAAPI so it can be interrupted, seeked (for deterministic demo capture)
and cancelled. Timings are in DESIGN.md. Reduced motion skips it entirely.

### 5.6 Share card
`OffscreenCanvas` 2D drawing (not DOM screenshotting): deterministic, fast, no html-to-image
dependency, works with the bundled fonts via `FontFace` loaded in the extension page context.

## 6. Budgets (enforced by `scripts/check-size.mjs`)

| Bundle | Budget (gzip) |
|---|---|
| `scanner.content.js` (every page) | ≤ 22 KB |
| `overlay.content.js` (on demand) | ≤ 95 KB |
| `popup` entry | ≤ 90 KB |
| `options` entry | ≤ 110 KB |
| Landing initial JS | ≤ 120 KB (bible §11.3 B1) |

Measured at the end of fix round 1 (gzip -6, KiB): scanner 27.7, overlay 134.3, popup entry 137.3
(its own 3.8, a shared React + motion + UI chunk of about 120, Disclosure 5, CSS 7.4), options entry 132.1.
None of the four meets the table. `scripts/check-size.mjs` fails the build above a **ceiling** set at
these sizes (scanner 29, overlay 140, popup 142, options 141) and prints "over target" for the
distance to the table, so they can no longer grow unnoticed. The budgets above stay the targets.
The popup and options share a chunk with the overlay UI; moving `motion` and `lucide-react` out of the
shared controls is the way down. The scanner also carries `@wxt-dev/storage` code that nothing in
`src/` imports (a transitive import that was not found in this round).

The overlay is loaded ahead of the click: hovering or focusing a marker sends one `openOverlay`
request with kind `close`, which injects the script and mounts it without showing anything. The first
card then skips the script compile (150-260 ms click-to-card measured before this change).

Popup first paint ≤ 100 ms; scan ≤ 50 ms median on corpus pages; overlay first open ≤ 80 ms injection
hop plus flight.

## 7. Privacy enforcement

- `scripts/check-network.mjs`: fails CI if the built output contains `fetch(`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon` or `EventSource` outside the BYO-key module's chunk.
- E2E: a Playwright test loads 10 corpus pages with the extension and asserts zero requests from
  `chrome-extension://` origins (and none initiated by content scripts).
- Production builds strip `console.*` except `console.error` with fixed, content-free messages;
  oxlint `no-console` with that allowance.
- No remote code, no remote config, no CDN fonts. CSP for extension pages:
  `script-src 'self'; object-src 'self'`.

## 8. Testing approach and fixture strategy

| Layer | Tool | What | When |
|---|---|---|---|
| Unit | Vitest + happy-dom | `core/*` with a fake `StyleOracle`; extractor rule tables (≥ 15 cases per family); rollup and badge text; settings migrations | Every push, < 20 s |
| Component | Vitest + Testing Library | Chip, Ledger, Card states (matched, low confidence, many-to-one, not found, external), popup states | Every push |
| Corpus | Playwright Chromium | `corpus/score.ts` loads each fixture, runs the real core with the real `StyleOracle`, scores against `expected.json` | Every push; gates in SPEC AC-F9.2 |
| E2E | Playwright, Chromium persistent context with `--load-extension=.output/chrome-mv3` | Badge, popup, card, tether geometry after scroll/resize, Show all J/K, Esc focus return, reduced motion, zero layout shift, zero network, share PNG golden | Every push |
| Firefox | `wxt build -b firefox` + `web-ext lint` in CI; manual smoke checklist in HANDOFF.md | Playwright cannot load Firefox extensions headlessly, so Firefox behavior is checked by hand before release | Every push (build+lint), release (manual) |
| Visual | Playwright screenshots | Popup, card, rail, options at real sizes, light and dark, reduced motion | Every push; goldens committed |
| Accessibility | `@axe-core/playwright` 4.14.0 | Zero violations on all extension pages and an open card | Every push |
| Design tokens | `scripts/check-tokens.mjs` with culori | Accent ΔE_OK ≥ 0.06 vs blocklist; WCAG/APCA pairs from DESIGN.md; no raw palette classes; no `rem` in shadow CSS | Every push |

**Fixture strategy (corpus):**

- `corpus/capture.ts` (Playwright, dev-time network only) loads a real URL, waits for idle, opens all
  `<details>` and `[aria-expanded=false]` toggles in a copy, strips scripts, iframes, images, media,
  fonts, inline event handlers and tracking attributes, and writes a **reduced snapshot** that keeps
  tag structure, classes, ids, inline `font-size` from computed style (so the small-font signal
  survives without the site's CSS) and text. Plus `meta.json`: source URL, capture date, family, the
  capturer's notes.
- `expected.json` is hand-labeled in a small labeling page (`pnpm corpus:label <fixture>`) that runs
  the scanner, shows each marker, and lets the labeler pick the footnote block, sentence span and
  chips. Labels are reviewed in PRs like code.
- Scoring: marker recall (found markers ∩ labeled), pair precision and pair recall
  (marker-to-footnote, sentence-level for many-to-one), chip recall per kind, false-positive markers
  on negative fixtures. Output `corpus/report.json`; `pnpm corpus:readme` writes the README table.
- Real-page fixtures stay minimal, credit the source, and are removed on request; synthetic fixtures
  are labeled synthetic in their folder name.

## 9. Optional LLM layer (F12)

- **Default: none.** The core never depends on a model.
- **On-device (picks.json's "optional Gemini Nano"):** feature-detect Chrome's built-in AI APIs at
  runtime and generate one line of at most 8 words from the chips and sentence; no network. The
  exact API surface (Summarizer vs Prompt API, availability states, download prompts) is to be
  confirmed with Context7 against current Chrome docs when F12 is built; it is post-MVP.
- **BYO-key cloud fallback (specified, not scheduled):** per studio rule, the default provider is
  Claude through the official `@anthropic-ai/sdk` (0.135.0), default model `claude-opus-5-5`, with a
  user-selectable cheaper model (`claude-haiku-5-5`) in Options. The call is user-initiated (a "Explain
  this catch" button), sends only the matched sentence and chips, never the page or URL, stores the
  key in `chrome.storage.local`, and lives in `features/plain-line/byo-key.ts`, the only module
  allowed to make network requests. Browser-context use of the SDK needs its explicit browser opt-in
  flag; confirm the exact option name against the SDK docs at build time. Refusal handling: check
  `stop_reason` before reading content, and fall back to showing chips only.

## Consequences

- **Easier:** the badge on every page costs one small script; core logic is testable without a
  browser; the landing page demonstrates the real engine; accuracy is a CI number, not an opinion.
- **Harder:** two content scripts plus a message hop; px-only CSS inside shadow roots; document-level
  font registration; Firefox behavior is verified manually.
- **Revisit:** anchor positioning once Firefox support is confirmed (could drop the fallback for the
  card); same-origin `/legal` fetch (v2); same-origin iframes (v1.1 if the corpus needs it);
  TypeScript 7 tooling compatibility.

## Action items

1. [x] Scaffold with exact pins (done in Stage 2). TypeScript is pinned to 6.0.3, not 7.0.2: the
       blocker is `typescript-eslint`'s peer range (`<6.1.0`), not WXT. `wxt prepare` and
       `tsc --noEmit` pass on 6.0.3; 7.0.2 was not tried with WXT.
2. [ ] Spike (half a day): anchor positioning from a shadow-root card to a host element carrying an
       inline `anchor-name`, in Chrome stable and Firefox stable. Record the result here and choose
       the per-browser card path.
3. [ ] Spike: measure the `executeScript` overlay hop on the CI runner; keep option B if ≤ 80 ms.
4. [ ] Build the 12 synthetic fixtures and the scorer before the matcher (tests first), then capture
       the 30 real pages.
5. [ ] Wire size-limit, check-network, check-tokens and the corpus gate into CI.
6. [ ] Confirm the Chrome built-in AI API with Context7 before starting F12 (post-MVP).
