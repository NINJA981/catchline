# Catchline: product spec

Status: Stage 1 (architect). Nothing is built yet. Every acceptance criterion below is a target to
test against, not a claim about shipped behavior.

Source of truth: `_studio/picks.json` entry `catchline` (refined scope, signature moment, risks) and
the council transcript `_studio/council/L18-3-catchline.md`. Where this spec adds emphasis (the
utility fix in section 4), picks.json wins on any conflict.

---

## 1. Problem

Promo and pricing pages put the condition far away from the claim. "$0 down*", "0% intro APR†",
"Up to 50% off*", "Unlimited¹" sit in large type at the top of the page. The condition sits in a
9-12px block thousands of pixels below, often in a collapsed "Offer details" accordion, and the
marker is almost never a link. The reader has to scroll, find the matching symbol, and work out
which of several footnotes belongs to which claim. Most people do not, so they find out about the
$35 activation fee, the 36-month term or the post-intro rate after they have paid.

Prior tools (littlefoot, Bigfoot.js, the 2011 Footnotify extension, Wikipedia reference tooltips)
only handle footnotes that are linked with `href="#fn1"` to an element id. Commerce pages rarely
link them, and none of those tools pull the conditions out of the footnote text.

## 2. Users

- **Primary:** desktop browser users reading an offer before paying: phone and broadband plans,
  credit cards and bank accounts, retailer sales, streaming plans, SaaS pricing tables, airline and
  hotel fares.
- **Secondary:** people who share "look at the catch" screenshots with a friend or on social media.
- **Not a user (v1):** phone-only shoppers. Mobile Chrome does not run extensions; Firefox Android
  and Safari are v2 (section 8).

## 3. Daily trigger

Catchline runs on every page as a content script and scans quietly after the page settles. When it
finds at least one **catch** (a matched claim whose footnote yields at least one term chip, or whose
claim text carries a price, rate or percentage), the toolbar badge shows the count. The user does
not have to remember to use it: the badge is the reminder, on any site, on every visit.

What counts toward the badge is deliberately narrow so the number stays trustworthy:

- Counted: commerce catches (money, time, rate, requirement, exclusion or renewal terms found).
- Listed in the popup but not counted: plain reference footnotes (Wikipedia-style `[1]`, blog
  footnotes) and markers whose footnote has no extractable terms.
- Never counted: excluded markers (cents superscripts, math, code, trademark symbols).

## 4. Utility fix (council weakness: Utility 5/10)

The council scored utility 5 because the original trigger set was mostly telecom deals, which most
people read a few times a year. This spec widens it in three ways. Each one is a requirement, not a
note.

### 4.1 Wider trigger set

The marker scanner and catch extractor cover any `*`, `†`, `‡`, `§`, `¶`, `<sup>` digit or Unicode
superscript claim on these page families, each with its own extractor vocabulary and its own fixture
slice (section 11):

| Family | Example claims | Terms the extractor must chip |
|---|---|---|
| Carrier / broadband | "$0/mo*", "Unlimited¹", "$200 off†" | contract or term length, activation and setup fees, autopay or paperless discount conditions, new line, trade-in, credits applied over N months, deprioritization after N GB, price after N months |
| Bank / credit | "0% intro APR†", "$300 bonus*", "No annual fee¹" | intro period length, go-to APR or range, balance transfer fee %, minimum spend and window, direct-deposit requirement, credit approval, annual fee after year 1 |
| Shopping / retail | "Up to 50% off*", "Free shipping†", "Extra 20% with code‡" | minimum order, excluded items or brands, member-only, one per customer, while supplies last, in-store only, end date |
| Streaming | "$7.99/mo*", "Free for 30 days†" | price after trial or promo, auto-renewal, with ads, annual billing, new subscribers only, number of screens |
| SaaS pricing | "$8 per user/mo*", "Unlimited projects†" | billed annually, per seat, minimum seats, usage caps, overage price, price after N months |
| Airline / travel | "From $49*", "Fares from $199 round trip†" | one-way vs round trip, taxes and fees excluded, bag fees, non-refundable, per person based on double occupancy, blackout dates, select routes |

The **markerless escape hatches** from picks.json ("Terms apply", "See offer details",
"Restrictions apply", "Conditions apply", "Some exclusions apply") are scanned on all families.

### 4.2 Badge rollup on every page visit

The toolbar badge shows the catch count (at most 4 characters, Chrome limit). The badge tooltip and
the popup header carry the rollup: count plus the summed money terms and the longest time term, for
example `7 catches: $35 + 36 months hidden` (picks.json's `7 claims · $35 + 36 months hidden`
wording, with the middle dot replaced per DESIGN.md's ban on middle-dot strings). Value shows on
every page that has one, without a click.

### 4.3 Published match rate

The fixture corpus (30 saved pages across the six families, plus synthetic edge cases) runs in CI on
every push. The README publishes precision and recall per family from the generated
`corpus/report.json`, with the commit it was measured at. If a number has not been measured yet, the
README says "not yet measured", never a guess.

## 5. MVP features

Numbering follows picks.json `refined_scope` items 1-9, plus the optional summary.

| # | Feature | Summary |
|---|---|---|
| F1 | Marker scanner | Finds `*`, `†`, `‡`, `§`, `¶`, `<sup>` digits/symbols, Unicode superscript digits (`¹²³⁴⁵⁶⁷⁸⁹⁰`), and markerless escape-hatch phrases. Excludes cents superscripts (1-2 digit `<sup>` directly after a currency amount or digit run), math (`<math>`, KaTeX/MathJax containers), code (`<code>`, `<pre>`, `<kbd>`, `<samp>`), `™ ® ©`, and `*` used as a bullet or rating. |
| F2 | Two-stage matcher | Stage A: linked footnotes (`href="#id"`, `aria-describedby`, `aria-details`). Stage B: bottom-up heuristic search for the same marker glyph at the start of a block inside footer, legal, disclaimer, terms, fine-print and "offer details" containers, then small-font blocks (computed font-size at most 0.85 of body). Reads hidden accordion, `<details>`, `hidden` and `aria-hidden` text through `textContent`. Every match carries a confidence score 0-1 and its signals. Unmatched markers get an explicit "No footnote found" state. |
| F3 | Many-to-one handling | When one footnote serves several claims (a generic `*` on 14 claims pointing at a 600-word offer blob), each claim tethers to the sentence with the highest token overlap with that claim; the full footnote sits behind an expander that states its word count. |
| F4 | Catch extractor | Deterministic regex and keyword rules turn the matched sentence or footnote into chips of six kinds: money, time, rate, requirement, exclusion, renewal (vocabulary per family in 4.1). The raw footnote text is always shown under the chips. |
| F5 | Tether overlay | An SVG bezier from the claim to a card anchored next to the claim, positioned with CSS anchor positioning where it works and a measured-geometry fallback where it does not (ADR 0001, section 5.4). Survives scroll, resize, sticky headers and lazy content (MutationObserver). Renders inside a Shadow DOM root; never reflows the host page. |
| F6 | Show all catches | The page dims, every claim fans a tether out to a card rail on the right, J/K steps between catches, Enter opens, Esc exits. |
| F7 | Toolbar badge rollup | Badge count plus tooltip rollup (4.2); popup ledger of money, time and requirement terms for the current tab. |
| F8 | Share this catch | Renders a 1200x630 PNG of one catch (claim, tether, chips, raw footnote, source hostname and capture date) locally on a canvas, with no page chrome. Save to disk or copy to clipboard. |
| F9 | Fixture corpus + CI match rate | 30 reduced snapshots of real promo pages plus synthetic edge cases, hand-labeled expected pairs and chips, scored in CI, numbers published in the README (4.3). |
| F10 | Popup | Current tab: rollup ledger, list of catches with confidence, per-site on/off, entry to Show all and Options. |
| F11 | Options + welcome page | Where Catchline runs, disabled sites, marker display, motion and theme preferences, privacy statement, shortcut list, measured corpus numbers. The welcome page (opened once on install) teaches the gesture on a labeled specimen. |
| F12 | Optional plain-language line (off by default, post-MVP stretch) | picks.json: "Optional Gemini Nano one-line 'the catch in 8 words'". Uses Chrome's on-device built-in AI when the browser exposes it; nothing leaves the device. A BYO-key cloud fallback is specified in ADR 0001 but not scheduled. Chips and raw text never depend on it. |

## 6. Non-goals (v1)

- Fine print inside images, canvas or video (no OCR). The README says so.
- Fetching separate `/legal` or `/terms` pages. Shown as a "Terms are on another page" link chip; a
  same-origin fetch is v2 (picks.json).
- Cross-origin iframes. Same-origin iframes are v1.1 if the corpus shows they matter.
- Judging the merchant. Catchline shows the merchant's own words; it never labels an offer a scam,
  scores it, or colors it red.
- Price history, deal comparison, coupons, affiliate links, accounts, sync, cloud anything.
- Mobile browsers (v2), Safari (v2).

## 7. Data model

All types live in `src/core/types.ts`. Element references are live `WeakRef<Element>` in memory
only; nothing below is persisted except where section 9 says so.

```ts
type MarkerGlyph = '*' | '†' | '‡' | '§' | '¶' | `sup:${string}` | `uni:${string}` | 'phrase';

interface Marker {
  id: string;               // stable per scan: hash of DOM path + glyph + ordinal
  glyph: MarkerGlyph;
  claimText: string;        // the sentence or heading the marker qualifies, trimmed to 200 chars
  claimEl: WeakRef<Element>;
  markerEl: WeakRef<Element> | null; // null for markerless phrases
  family: Family | 'unknown';         // carrier | bank | retail | streaming | saas | travel
}

interface FootnoteBlock {
  id: string;
  text: string;             // full textContent, whitespace-collapsed
  source: 'linked' | 'legal-container' | 'small-font' | 'details' | 'hidden';
  el: WeakRef<Element>;
  wordCount: number;
}

interface Match {
  markerId: string;
  footnoteId: string | null;          // null = "No footnote found"
  sentence: { start: number; end: number } | null; // span in FootnoteBlock.text (F3)
  confidence: number;                 // 0..1
  signals: MatchSignal[];             // e.g. 'href', 'same-glyph-block-start', 'legal-container', 'small-font', 'token-overlap:0.42'
  external?: { href: string; host: string }; // "Terms are on another page"
}

type ChipKind = 'money' | 'time' | 'rate' | 'requirement' | 'exclusion' | 'renewal';
interface Chip { kind: ChipKind; label: string; value?: number; unit?: string; span: [number, number] }

interface Catch { marker: Marker; match: Match; chips: Chip[]; counted: boolean }

interface TabRollup {        // kept in chrome.storage.session, keyed by tabId
  tabId: number;
  catches: number;           // badge number
  listed: number;            // includes uncounted reference footnotes
  money: { total: number; currency: string; items: string[] };
  longestTerm: { months: number; label: string } | null;
  requirements: string[];
  scannedAt: number;         // epoch ms
}

interface Settings {         // chrome.storage.local, versioned (WXT storage.defineItem)
  version: 1;
  runOn: 'all-sites' | 'on-click';
  disabledHosts: string[];   // hostnames only
  markCatchesOnPage: boolean; // thin underline under detected markers
  badge: boolean;
  motion: 'system' | 'reduce';
  theme: 'system' | 'light' | 'dark';
  plainLine: { enabled: boolean; provider: 'on-device' | 'byo-key' };
  byoKey?: string;           // only if the user adds one; see section 9
}
```

## 8. Platform matrix

| Platform | v1 status | Notes |
|---|---|---|
| Chrome desktop (MV3) | Primary, tested in CI | Minimum version set by the anchor-positioning decision in ADR 0001 (fallback path keeps older Chrome working). |
| Edge desktop | Same Chromium build, smoke-tested manually | Store listing optional. |
| Brave, Arc, Vivaldi, Opera | Same Chromium build, untested | Listed as "expected to work", not "supported". |
| Firefox desktop (MV3) | Supported, built with `wxt -b firefox`, e2e smoke in CI | Host permissions are opt-in on Firefox MV3, so the welcome page asks for them. Built-in AI (F12) is unavailable. |
| Firefox Android | v2 | |
| Safari macOS / iOS | v2 | |
| Chrome Android / iOS browsers | Not possible | No extension support. |

## 9. Privacy model

**Network policy: Catchline makes no network requests.** No analytics, telemetry, crash reporting,
remote config, font CDN or update ping beyond what the browser store does itself. The one exception,
only if the user turns it on, is F12's BYO-key provider; the on-device provider makes no requests.

| Data | Where | Lifetime | Leaves the device? |
|---|---|---|---|
| Page text, matches, chips | Content-script memory | Until navigation or tab close | Never |
| Per-tab rollup (counts, term strings) | `chrome.storage.session` keyed by tabId | Until the browser closes or the tab closes | Never |
| Settings, disabled hostnames | `chrome.storage.local` | Until the user changes them or uninstalls | Never |
| Share PNG | Generated in memory, saved where the user chooses | User's file | Only if the user sends it |
| BYO API key (F12, opt-in) | `chrome.storage.local`, plain (the README states it is not encrypted at rest) | Until removed in Options | Sent only to the provider's API, only on the user's click |
| Browsing history, URLs | Not stored | n/a | Never |

Rules: no `console.log` of page text, keys or URLs in production builds (lint rule plus a CI grep of
the built bundle); keys are never logged, never included in error reports, and masked in the UI
after entry. Enforcement is in ADR 0001, section 7.

## 10. Acceptance criteria

Each criterion maps to a test (`unit` = Vitest on fixtures, `e2e` = Playwright with the built
extension loaded, `ci` = corpus scorer or a build check). The corpus targets in AC-F9 are initial
gates; the published numbers are whatever CI measures.

### F1 Marker scanner
- AC-F1.1 (unit) On the synthetic `glyphs.html` fixture, detects all 7 marker forms (`* † ‡ § ¶`, `<sup>2</sup>`, `²`) and the 5 escape-hatch phrases, with zero misses.
- AC-F1.2 (unit) On `cents.html`, `$49<sup>99</sup>`, `$4<sup>.99</sup>` and `19<sup>99</sup>` produce zero markers.
- AC-F1.3 (unit) Markers inside `<code>`, `<pre>`, `<math>`, `.katex` and `<kbd>`, and `*` used as a list bullet or star rating, produce zero markers.
- AC-F1.4 (unit) A scan of the largest corpus page completes in at most 50 ms median over 20 runs on the CI runner (measured in Vitest with happy-dom; recorded, gate at 2x).

### F2 Two-stage matcher
- AC-F2.1 (unit) A linked footnote (`<a href="#fn3">3</a>` to `id="fn3"`) matches with confidence 1.0 and signal `href`.
- AC-F2.2 (unit) An unlinked `†` matches a `†`-prefixed block inside `footer`, `[class*=legal]`, `[class*=disclaimer]` or `[id*=terms]`, with confidence at least 0.7.
- AC-F2.3 (unit) Footnote text inside a closed `<details>` and an `aria-hidden="true"` accordion panel is matched.
- AC-F2.4 (unit) A marker with no candidate block yields `footnoteId: null`, and the card renders "No footnote found" (never a guessed match).
- AC-F2.5 (unit) A footnote rendered after a 2 s delay (lazy legal drawer fixture) is matched within 500 ms of insertion via MutationObserver.

### F3 Many-to-one
- AC-F3.1 (unit) On `many-to-one.html` (one `*`, 14 claims, a 612-word offer block), each of the 14 claims gets a sentence span, and at least 12 of 14 equal the hand label.
- AC-F3.2 (e2e) The card shows only the chosen sentence by default and an expander labeled with the word count ("Show all offer details, 612 words"); expanding reveals the full text.

### F4 Catch extractor
- AC-F4.1 (unit) Each family has at least 15 table-driven extractor cases, all passing, including "$35 activation" (money), "36-month" (time), "0% intro APR for 15 months, then 19.24%-29.99% variable" (rate + time), "autopay required" (requirement), "excludes clearance items" (exclusion), "renews at $17.99/mo" (renewal).
- AC-F4.2 (e2e) Every card renders the raw footnote text (or matched sentence plus expander) below the chips, including cards with zero chips.

### F5 Tether overlay
- AC-F5.1 (e2e) Clicking a marker opens its card beside the claim with a tether whose endpoints stay within 2 px of the claim and card edges after scrolling 1,000 px, resizing to 768 px wide, and with a 64 px sticky header present.
- AC-F5.2 (e2e) Opening and closing cards causes zero layout shift on the host page (no host element changes its bounding box; checked with `getBoundingClientRect` before and after).
- AC-F5.3 (e2e) Host page CSS (a fixture with `* { color: red !important; font-size: 30px }`) does not change the card's computed font, size or colors.
- AC-F5.4 (e2e) Esc closes the open card and returns focus to the marker hit target.
- AC-F5.5 (e2e) With `prefers-reduced-motion: reduce`, the flight does not run: the card and tether appear with an opacity fade of at most 150 ms.

### F6 Show all catches
- AC-F6.1 (e2e) The shortcut (default Alt+Shift+C, via the `commands` manifest key) and the popup button both enter Show all; every counted catch has a card in the rail.
- AC-F6.2 (e2e) J and K move selection with no animation (0 ms) and scroll the selected claim into view; Enter expands; Esc exits and restores the page scroll position.
- AC-F6.3 (e2e) J/K are ignored while focus is in a host page input or contenteditable.

### F7 Badge rollup
- AC-F7.1 (e2e) On the carrier demo fixture the badge reads the counted catch number, and the tooltip reads `N catches: $X + Y months hidden` (format from section 4.2).
- AC-F7.2 (e2e) On a page with only Wikipedia-style reference footnotes the badge is empty, while the popup lists them under "Other footnotes".
- AC-F7.3 (e2e) The badge clears on navigation and is per tab (two tabs show independent counts).

### F8 Share this catch
- AC-F8.1 (e2e) "Save image" produces a 1200x630 PNG within 300 ms containing the claim, chips, raw text excerpt, hostname and date; pixel-compared against a golden with at most 0.5% difference.
- AC-F8.2 (e2e) No network request is made while generating or saving (Playwright request log is empty for extension origins).

### F9 Corpus + CI
- AC-F9.1 (ci) `pnpm corpus` scores all fixtures and writes `corpus/report.json` with per-family marker recall, pair precision, pair recall and chip recall.
- AC-F9.2 (ci) Initial gates: pair precision at least 0.90 and pair recall at least 0.75 over the 30 real pages; zero false-positive markers on the negative fixtures. A drop of more than 2 points from `main` fails the build.
- AC-F9.3 (ci) The README table is regenerated from `report.json` by `pnpm corpus:readme` and CI fails if it is stale.

### F10 Popup
- AC-F10.1 (e2e) First paint at most 100 ms after open (reads the tab rollup from `storage.session` synchronously on load; measured with `performance.now()` in a test hook).
- AC-F10.2 (e2e) Shows the correct state for: scanning (skeleton after 150 ms), no catches, catches, restricted page (`chrome://`, store pages), disabled on this site, permission needed (Firefox).
- AC-F10.3 (e2e) The per-site toggle takes effect without reload of the popup and persists across browser restart.

### F11 Options + welcome
- AC-F11.1 (e2e) Every setting in `Settings` is editable, persists, and is reflected in content scripts within 1 s (storage change listener).
- AC-F11.2 (e2e) The welcome page specimen runs the real overlay and is labeled "Specimen page. Not a real offer."
- AC-F11.3 (ci) The corpus numbers shown in Options are read from the bundled `report.json` at build time.

### F12 Optional plain line
- AC-F12.1 (unit) With the setting off (default), no built-in AI API is touched and no request code path is reachable.
- AC-F12.2 (e2e) When on and unavailable (Firefox, or Chrome without the model), the card shows chips and raw text unchanged and Options explains why the line is missing.

### Cross-cutting
- AC-X.1 (e2e) Loading 10 corpus pages with the extension produces zero network requests from extension origins.
- AC-X.2 (ci) The built bundle contains no `fetch(`, `XMLHttpRequest`, `WebSocket` or `sendBeacon` outside `src/features/plain-line/byo-key.ts`.
- AC-X.3 (e2e) axe-core reports zero violations on popup, options, welcome and an open card, in light and dark.

## 11. Fixture corpus plan

- 30 real pages: 6 carrier/broadband, 6 bank/credit, 6 retail, 4 streaming, 4 SaaS pricing, 4 airline/travel.
- Captured with `pnpm corpus:capture <url>` (Playwright): scripts, images, media, fonts and tracking stripped; DOM serialized after load and after expanding every `<details>`; stored as a **reduced snapshot** that keeps structure, classes and text needed for matching. Each fixture folder holds `page.html`, `meta.json` (source URL, capture date, family, notes) and `expected.json` (hand-labeled marker-to-footnote pairs, sentence spans, chips).
- About 12 synthetic edge fixtures, authored by hand and labeled synthetic: glyph forms, cents superscripts, math and code, reference footnotes, `<details>`, lazy legal drawer, sticky header, many-to-one, image-only fine print (expected "not found"), shadow-DOM host, hostile CSS.
- Real-page fixtures are kept to the minimum text needed for testing, credited to the source in `meta.json` and the README, and removed on request.

## 12. Demo script (10 seconds, muted, 1:1 and 16:9)

Recorded deterministically from the e2e harness on the carrier specimen fixture (labeled synthetic
in the post), not screen-recorded.

| Time | Shot | What is on screen |
|---|---|---|
| 0.0-1.2 s | Hero claim | A plan card fills the frame: "$0/mo*" in large type, "Unlimited¹" under it. The toolbar badge in the top-right corner already reads `3`. |
| 1.2-2.0 s | Click | Cursor clicks the `*`. A 2 px accent ring settles on the asterisk. |
| 2.0-2.6 s | Lift off | Cut to the bottom of the page (or a split frame): the 9 px footnote "*With 36-month installment agreement. $35 activation fee. Autopay required..." lifts off; a dashed ghost outline stays where it was. |
| 2.6-4.2 s | Flight | The footnote flies up a glowing bezier tether, growing from 9 px to readable size as it rises. The page does not move. |
| 4.2-5.0 s | Dock | The card docks beside "$0/mo*". |
| 5.0-6.6 s | Chips | Chips pop in one by one: "$35 activation", "36-month contract", "Autopay required". The raw footnote text sits under them. |
| 6.6-8.4 s | Show all | Alt+Shift+C: the page dims and three tethers fan out to a rail of cards; J steps to "Unlimited¹", whose card reads "Slower after 50 GB". |
| 8.4-10.0 s | End frame | Esc exits Show all, the popup opens: the popup ledger "3 catches: $35 + 36 months hidden" and the line "Free. Runs in your browser. No account." |

LinkedIn copy (from picks.json): "Every asterisk on the internet is a promise with a catch 3,000
pixels below it. I built an extension that drags the catch back up to the promise."

## 13. Web app (`site/`, route `/app/`)

Most people who see the LinkedIn post are on a phone, where extensions cannot run. The web app runs
the same engine (`src/core`, imported through the `@catchline/core` Vite alias, never copied) on
text or HTML the visitor pastes, or on a bundled sample page from the synthetic fixtures, and shows
every claim with its catch. It is a static, installable (PWA), offline-capable page. It is not a
second product: no accounts, no storage of pasted content, no network beyond its own static files.

**Scope.** Input: paste box, "Open a saved page" file picker, eight bundled samples (`tests/fixtures/synthetic`),
and `#sample=<id>` deep links. It cannot open a URL: browsers block cross-origin page fetches
(CORS), and the page says so and offers paste. Output: rollup line and ledger, catch list, the page
as readable text with every marker as a button, the catch card with the footnote flight and tether,
and the share-this-catch PNG (1200 x 630, rendered locally by the extension's share painter).
Pasted markup is parsed with `DOMParser` (inert: no script runs, no resource loads) and only ever
read as text.

**Acceptance criteria.** Tests live in `site/tests` (`engine.test.ts`, `guards.test.ts` with Vitest;
`e2e/site.spec.ts` with Playwright against the production build, `pnpm test:e2e`).

- AC-W1 (e2e) The empty state shows the line "Runs entirely in your browser. Nothing is uploaded.", a "Try a sample" button and the CORS note; it logs no console errors.
- AC-W2 (e2e) "Try a sample" on the carrier specimen shows `3 catches: $35 + 36 months hidden`, three catch rows, and opens a card with three chips and the highlighted raw footnote when a marker is activated; the footnote gets a ghost outline and the card closes on Esc.
- AC-W3 (unit) All eight samples produce the expected counted and listed catch counts through the real engine, and every marker and matched footnote is findable in the reader view.
- AC-W4 (e2e) Pasting plain text works; pressing "Find the catches" with an empty box shows the error state ("Nothing to scan"), and a following valid paste clears it.
- AC-W5 (e2e) The not-found sample shows "No footnote found" in the card; the many-to-one sample shows the chosen sentence first and an expander that reveals the whole offer block.
- AC-W6 (e2e) "Save image" downloads a PNG named `catchline-<host>-<date>.png` that is exactly 1200 x 630.
- AC-W7 (e2e) The signature flight plays on the first card open (a clone exists, then is removed) and not under `prefers-reduced-motion: reduce`; J and K step between catches with no animation.
- AC-W8 (e2e) At 375 px wide there is no horizontal scroll and every button, row and summary is at least 44 px tall.
- AC-W9 (e2e) After the first load the worker precaches the build; with the network off, reloading `/app/#sample=<id>` still scans and opens a card. The manifest has `start_url` `./app/`, `display: standalone` and 192 and 512 px icons (unit).
- AC-W10 (e2e, unit) The pages make no request to any other origin (Playwright request log), the built output has no `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or external URL (`pnpm check:network`), and the Content-Security-Policy has `connect-src 'none'`.
- AC-W11 (unit) The site CSS uses only DESIGN.md tokens: no color literals outside the shared token file, spacing, radius and type sizes from the scales, no `transition: all`, no gradients.
- AC-W12 (lighthouse, trace) On a throttled mobile profile (4x CPU, Slow 4G) LCP is at most 2.0 s and CLS is 0; Lighthouse accessibility and best-practices are at least 95. Initial JS is at most 120 KB gzip (`pnpm check:budget`).
