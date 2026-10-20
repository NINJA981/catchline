---
version: alpha
name: Catchline
description: "The leader line between a promise and its condition. Prussian ink on cool ledger paper, Schibsted Grotesk set tight, Commit Mono for the numbers, one blue line that carries the fine print up the page."
colors:
  # Light (default). Canonical values are OKLCH; hex in the prose is the computed sRGB.
  ledger-paper: "oklch(0.99 0.003 240)"
  sheet: "oklch(1 0 0)"
  sheet-2: "oklch(0.965 0.006 240)"
  rule: "oklch(0.915 0.009 240)"
  rule-strong: "oklch(0.62 0.015 240)"
  ink: "oklch(0.22 0.02 245)"
  ink-muted: "oklch(0.46 0.02 245)"
  ink-subtle: "oklch(0.55 0.018 245)"
  prussian: "oklch(0.45 0.10 238)"
  prussian-deep: "oklch(0.40 0.085 238)"
  on-prussian: "oklch(0.99 0.004 238)"
  prussian-wash: "oklch(0.95 0.02 238)"
  prussian-ink: "oklch(0.45 0.10 238)"
  tether-glow: "oklch(0.45 0.10 238 / 0.22)"
  scrim: "oklch(0.12 0.01 245 / 0.45)"
  success: "oklch(0.52 0.12 150)"
  success-wash: "oklch(0.95 0.035 150)"
  warning: "oklch(0.50 0.11 65)"
  warning-wash: "oklch(0.95 0.045 80)"
  danger: "oklch(0.54 0.19 27)"
  danger-wash: "oklch(0.95 0.026 25)"
  # Dark (re-derived, not inverted)
  ledger-paper-dark: "oklch(0.17 0.012 245)"
  sheet-dark: "oklch(0.205 0.014 245)"
  sheet-2-dark: "oklch(0.24 0.016 245)"
  rule-dark: "oklch(0.29 0.016 245)"
  rule-strong-dark: "oklch(0.50 0.02 245)"
  ink-dark: "oklch(0.95 0.008 245)"
  ink-muted-dark: "oklch(0.80 0.016 245)"
  ink-subtle-dark: "oklch(0.69 0.016 245)"
  prussian-dark: "oklch(0.76 0.10 232)"
  prussian-deep-dark: "oklch(0.81 0.085 232)"
  on-prussian-dark: "oklch(0.17 0.035 240)"
  prussian-wash-dark: "oklch(0.28 0.05 236)"
  prussian-ink-dark: "oklch(0.80 0.09 232)"
  tether-glow-dark: "oklch(0.76 0.10 232 / 0.28)"
  scrim-dark: "oklch(0.12 0.01 245 / 0.65)"
  success-dark: "oklch(0.76 0.13 150)"
  warning-dark: "oklch(0.82 0.13 80)"
  danger-dark: "oklch(0.77 0.13 25)"

typography:
  hero:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "clamp(56px, 32px + 6vw, 120px)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "-0.035em"
  display:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 46px
    letterSpacing: "-0.025em"
  h1:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: "-0.015em"
  h3:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 550
    lineHeight: 24px
    letterSpacing: "-0.012em"
  lead:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 450
    lineHeight: 24px
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: "-0.005em"
  ui:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0
  label:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0
  caption:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: "0.005em"
  micro:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: "0.01em"
  fine-print:
    fontFamily: "Catchline Schibsted, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0
  mono-figure:
    fontFamily: "Catchline Commit, Commit Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0
    fontFeature: "tnum"
  mono-key:
    fontFamily: "Catchline Commit, Commit Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px

spacing:
  "0.5": 2px
  "1": 4px
  "1.5": 6px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "10": 40px
  "12": 48px
  "16": 64px
  "20": 80px
  "24": 96px
  "32": 128px

components:
  button-primary:
    backgroundColor: "{colors.prussian}"
    textColor: "{colors.on-prussian}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.prussian-deep}"
    textColor: "{colors.on-prussian}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: 32px
  button-secondary-hover:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
    height: 28px
  catch-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: 16px
    width: 336px
  chip:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    height: 24px
  fine-print-block:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.fine-print}"
    rounded: "{rounded.xs}"
    padding: "8px 12px"
  confidence-tag:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "0 4px"
  keycap:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.mono-key}"
    rounded: "{rounded.xs}"
    padding: "0 5px"
    height: 20px
  popup-shell:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    width: 380px
  ledger-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    height: 32px
  catch-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    padding: "8px 12px"
    height: 52px
  catch-row-selected:
    backgroundColor: "{colors.sheet-2}"
    textColor: "{colors.ink}"
  rail:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    width: 376px
  toggle-on:
    backgroundColor: "{colors.prussian}"
    rounded: "{rounded.full}"
    width: 32px
    height: 18px
  toggle-off:
    backgroundColor: "{colors.rule-strong}"
    rounded: "{rounded.full}"
    width: 32px
    height: 18px
  text-input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    height: 32px
  site-nav:
    backgroundColor: "{colors.ledger-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: 56px
---

# Design System: Catchline

## Overview

**Creative North Star: "The Leader Line"**

On an engineering drawing, a leader line runs from a callout to the exact part it describes. You
never have to guess which note belongs to which bolt. Catchline does that for offers: one thin
Prussian-blue line runs from the claim ("$0/mo*") to its condition, and the condition sits in a
ruled ledger card at reading size. Everything else on screen is cool paper, hairline rules and dark
ink, set tight and precise like an annotated statement. The line is the only color that moves.

Catchline lives on other people's pages, so restraint is the brand. It never reflows the host page,
never shouts, never colors a merchant's offer red. The card is a quiet document: the merchant's own
words, restored to a readable size, with the terms pulled out as plain chips above them. The one
place it spends motion is the first time a footnote flies up the page on its line.

Mode by surface: the popup, overlay and options page are **Operate** (precision and restraint; the
eye lands on the terms within one second). The landing page is **Persuade** (one bold idea: the
real engine pulling a real-looking footnote up a specimen page, at poster scale).

**Key Characteristics:**
- Cool ledger paper (`ledger-paper`) with white sheets and 1px hairline rules; dark ink, never black.
- One accent, Prussian blue, used only for the tether, the selected marker ring, focus and the one
  primary action per view.
- Schibsted Grotesk set tight for words; Commit Mono with tabular figures for every money amount,
  duration and rate, so terms align like a statement.
- Rect geometry with the Standard radius scale (4/6/8/12). No pills, except toggle tracks.
- Depth from rules and the surface ladder; layered, ink-tinted shadows only on things that float over
  a host page (cards, rail, popovers).
- Light-first, following the system; dark is re-derived.

### Blend notes (bible §10)

Archetype: A6 browser-extension popup, with the in-page overlay as its signature surface, borrowing
A3's data-dense discipline because the payload is money and terms. The studio assigned **D3 Prussian
Ledger** and **T1 Schibsted Grotesk + Commit Mono** so the five studio projects stay distinct (the
bible pairs D3 with T3 by default; T1 is the assigned deviation).

- **From stripe** we took tabular figures on every money cell, one filled button per band,
  level-based contrast (text and background at least five ramp steps apart), layered shadows tinted
  toward the ink hue, and "the product mockup is the proof" on the landing page. We rejected the
  gradient mesh, the indigo, pill buttons and the thin 300-weight display. Our version differs by
  carrying the money signature in a mono face inside a ruled ledger, not in a light display sans.
- **From linear.app** we took the compact 12/13/14 type ladder, hairline borders instead of
  shadows on resting surfaces, the dark-mode surface ladder, and the rule that the accent appears
  only on focus, the primary action and links. We rejected the near-black canvas as a default,
  lavender, and -3px display tracking. Ours is light-first on cool paper and uses a cold blue far
  from Linear's hue.
- **From theverge** we took two mechanisms: the timeline rail (StoryStream's vertical spine with
  entries hung off it), which becomes the Show all rail where each catch hangs off a spine with its
  page offset in mono ("3,140 px below"); and the shout/whisper type contrast, which becomes the
  landing hero's 120px claim over 13px fine print. We rejected the mint and ultraviolet, the
  900-weight condensed display, ALL-CAPS mono labels, 20-40px pill radii and dark-only pages.
- Swap test: no reference brand's colors, faces, wordmarks or surface ladders appear. Accent ΔE_OK
  to the nearest blocklisted brand color: light `#005c86` to Apple `#0066cc` = 0.113; dark `#6abce6`
  to Framer `#0099ff` = 0.130 (both ≥ 0.06; computed with the bible's OKLab method, re-checked in CI
  by `scripts/check-tokens.mjs`).

## Colors

A cold, institutional palette: ink-blue neutrals at very low chroma (hue 240-245) and one deep
Prussian accent. Color strategy: **Restrained** in the product (neutrals plus one accent doing real
jobs), still Restrained on the landing page, where the accent's single job is the tether at poster
scale.

### Primary
- **Prussian** (`oklch(0.45 0.10 238)` / `#005c86`; dark `oklch(0.76 0.10 232)` / `#6abce6`): the
  tether stroke, the open marker's 2px ring, the focus ring, the selected catch indicator, the one
  primary button per view, and links. 7.12:1 on `ledger-paper` (APCA Lc 83); dark 9.08:1 (Lc 61).
- **Prussian Deep** (`oklch(0.40 0.085 238)` / `#084d70`; dark `#87cbef`): hover and pressed fill of
  the primary button.
- **On Prussian** (`#f9fcfe`; dark `#01111d`): label on the filled button (7.12:1; dark 9.07:1,
  APCA 62, so dark-mode button labels are 13px/500 minimum per bible §4.3, and 14px/600 on the
  landing page).
- **Prussian Wash** (`oklch(0.95 0.02 238)` / `#e3f1fb`; dark `#0b2c3e`): text selection, the brief
  highlight of a chip's span inside the raw footnote, the claim highlight while its card is open.
- **Prussian Ink** (`#005c86`; dark `oklch(0.80 0.09 232)` / `#80c8ee`): accent as text, links
  (6.35:1 on Prussian Wash; dark 7.90:1).
- **Tether Glow** (`oklch(0.45 0.10 238 / 0.22)`; dark `/0.28`): the soft under-stroke of the
  tether. A glow is a stroke, never a fill or a background wash.

### Neutral
- **Ledger Paper** (`oklch(0.99 0.003 240)` / `#fafcfe`; dark `#0b1014`): popup, options and landing
  canvas; the background of the raw fine-print block inside cards.
- **Sheet** (`#ffffff`; dark `oklch(0.205 0.014 245)` / `#12181d`): cards, the rail's entries,
  inputs, secondary buttons.
- **Sheet 2** (`oklch(0.965 0.006 240)` / `#f0f4f7`; dark `#192026`): chips, keycaps, hover rows,
  selected rows, skeleton fill.
- **Rule** (`oklch(0.915 0.009 240)` / `#dee4e8`; dark `#252c33`): every hairline and divider.
- **Rule Strong** (`oklch(0.62 0.015 240)` / `#7e888e`, 3.53:1; dark `#5a656e`, 3.20:1): input
  borders, toggle-off track, the dashed ghost outline left where a footnote lifted off.
- **Ink** (`oklch(0.22 0.02 245)` / `#131c23`, 16.8:1, Lc 102; dark `#eaeff4`, 16.5:1): all primary
  text, chip text, the restored fine print.
- **Ink Muted** (`#4f5963`, 6.91:1, Lc 83; dark `#b6bfc8`, 10.25:1, Lc 67): secondary text,
  confidence tags, chip category glyphs, ledger labels.
- **Ink Subtle** (`#69737c`, 4.70:1 on paper, Lc 72; dark `#939da5`, 6.90:1, Lc 48): meta only
  (timestamps, page offsets, hostnames). Never on Sheet 2 at body size in light mode (4.38:1 there):
  on chips and hover rows use Ink Muted instead.

### Semantic
Fixed bible values. Semantic color describes Catchline's own state (saved, permission needed, scan
failed), never the merchant's offer.
- **Success** (`#287c42`; dark `#6fc884`) with a check icon: "Saved", "Copied", permission granted.
- **Warning** (`#8d5406` text on `#ffeccd`; dark `#f0ba59`) with an alert icon: "Permission needed",
  low-confidence explanation panel.
- **Danger** (`#c52c2a` on `#ffe8e6`; dark `#fc928a`) with an alert icon: Catchline errors only.
- **Info:** D3's info hue equals the accent, so info is shown as Ink Muted text plus an info icon.

### Scrim
`scrim` `oklch(0.12 0.01 245 / 0.45)` light, `/0.65` dark: dims the host page in Show all, with
SVG-mask cutouts around each counted claim.

### Named Rules
**The One Line Rule.** Prussian appears on at most 5% of any screen's pixels. On a host page, the
tether and the open marker ring are the only colored things Catchline draws.

**The Merchant's Words Rule.** No color ever editorializes a catch. Chips are neutral; there is no
red "gotcha", no warning yellow on fees, no severity scale.

## Typography

**Display and UI font:** Schibsted Grotesk (variable, 400-900; we use 400, 450, 500, 550, 600),
registered as `Catchline Schibsted`, fallback `system-ui, sans-serif`.
**Figure and key font:** Commit Mono (400, 500), registered as `Catchline Commit`, fallback
`ui-monospace, monospace`.

**Character:** a crisp newsroom grotesk with a technical mono for the figures: the voice of an
annotated statement. Schibsted carries every word; Commit Mono carries every number a user might
compare (money, months, rates, GB, page offsets) and every keyboard key.

Both are OFL-1.1 (verified on the Fontsource API 2026-10-20), bundled as subset woff2 files (Latin,
punctuation, `† ‡ § ¶ ¹ ² ³` and currency symbols, ≤ 40 KB each). Inside shadow roots the families
are registered at document level under the private names above (ADR 0001 §5.3). All sizes are px,
because host pages change the root font size.

### Hierarchy (Compact scale, bible §3.2)
- **Hero** (600, `clamp(56px, 32px + 6vw, 120px)`, line-height 0.92, -0.035em): landing page only,
  once. The claim at poster size.
- **Display** (600, 44/46, -0.025em): README and landing section openers.
- **H1** (600, 28/32, -0.02em): options page title.
- **H2** (600, 22/28, -0.015em): welcome page title, landing beat headings.
- **H3** (550, 18/24, -0.012em): the claim inside a card; options section titles.
- **Lead** (450, 16/24, -0.01em): landing body intro.
- **Body** (400, 14/22, -0.005em): landing and options prose, max 68ch.
- **UI** (400, 13/20, 0): default for popup, cards, rail.
- **Label** (500, 13/20): buttons, chips, ledger labels.
- **Fine print** (400, 13/20, Ink): the restored footnote text. Never smaller than 13px; the whole
  point is that the 9px original becomes readable.
- **Caption** (400, 12/16, +0.005em): confidence tags, hostnames, meta.
- **Micro** (500, 11/16, +0.01em): badge-adjacent counts only.
- **Mono figure** (Commit Mono 400, 12/16, `tnum`, 0.92× the UI size beside 13px text): every
  amount, duration, rate and page offset. Right-aligned in ledger columns.
- **Mono key** (Commit Mono 500, 11/16): keycaps.

Settings: `font-synthesis: none`; `text-wrap: balance` on headings, `text-wrap: pretty` on prose;
curly quotes, real ellipsis `…`, non-breaking space between number and unit (`36&nbsp;months`).

### Named Rules
**The Figures Are Mono Rule.** If a user might compare it, it is set in Commit Mono with tabular
figures. Words never are.

**The No Caps Rule.** No all-caps labels and no tracked-out eyebrows anywhere. Category names are
sentence case in Ink Muted.

## Layout

4px base unit; spacing tokens in the front matter. Density is Compact everywhere except the landing
page.

- **Popup:** 380px wide (set on `<body>`), height grows with content up to 560px; only the catch
  list scrolls (`scrollbar-gutter: stable`). Padding 12px; group gaps 16px; row height 32px (ledger)
  and 52px (catch rows: claim on line one, chips summary on line two).
- **Catch card (overlay):** 336px wide, 16px padding, 12px between groups. Placed on the side of the
  claim with more room (right, else left, else below), 12px from the claim box, never under a
  detected sticky header (8px below it), never off-viewport (clamped with 16px margins).
- **Show all rail:** 376px fixed column on the right edge of the viewport (on viewports under 900px
  it becomes a bottom sheet, 60dvh, per bible M2 geometry), cards stacked with 12px gaps along a 1px
  Rule spine at 20px from the rail's left edge. Each entry shows its page offset in Mono figure on
  the spine.
- **Options page:** single column, max 720px, 32px gutter at 1440 and 16px at 375; sections
  separated by 48px and a Rule.
- **Welcome page:** two columns at ≥ 1024px (specimen left 60%, steps right 40%), stacked below.
- **Landing page:** 12-column grid, 1200px max content, gutters 16/24/32 at 375/768/1440; section
  rhythm 96px desktop / 64px mobile; left-aligned text, asymmetric layouts. Details in
  `docs/LANDING.md`.
- **Z-index:** overlay host at `2147483647` inside its shadow root; inside the overlay: tether layer
  1, cards 2, rail 3, scrim 0.

## Elevation & Depth

Hybrid. Resting surfaces are flat and separated by Rules and the Sheet/Sheet 2 ladder. Anything that
floats over a host page gets a layered shadow tinted toward the ink hue (H 245), because a hairline
alone disappears on busy pages. Dark mode replaces shadows with surface steps (+0.035 L), a 1px Rule
and a top inner highlight; only the card and rail keep a shadow on dark.

### Shadow Vocabulary
- **e1 ring** (`0 0 0 1px var(--rule), 0 1px 2px oklch(0.25 0.02 245 / .04)`): inputs, the raw
  fine-print block, options panels.
- **e3 float** (`0 0 0 1px oklch(0.25 0.02 245 / .08), 0 2px 4px -1px oklch(0.25 0.02 245 / .08), 0 8px 16px -4px oklch(0.25 0.02 245 / .12)`):
  catch cards, tooltips, the marker hint.
- **e4 rail** (`0 0 0 1px oklch(0.25 0.02 245 / .08), 0 8px 16px -4px oklch(0.25 0.02 245 / .10), 0 24px 48px -12px oklch(0.25 0.02 245 / .22)`):
  the Show all rail and the flying footnote clone at peak lift.
- **Dark float** (`0 0 0 1px oklch(1 0 0 / .06), inset 0 1px 0 oklch(1 0 0 / .05), 0 24px 48px -12px oklch(0 0 0 / .6)`):
  cards and rail in dark mode.

### Named Rules
**The Rule Before Shadow Rule.** Inside the popup and options page nothing has a drop shadow. Shadow
exists only for things that float over someone else's page.

## Shapes

Standard radius personality: xs 4 (chips, keycaps, fine-print block, confidence tag), sm 6 (buttons,
inputs), md 8 (catch card, popup panels), lg 12 (landing frames, welcome specimen frame, rail bottom
sheet top corners), full (toggle track and thumb, marker ring only). Nested radii are concentric: the
fine-print block (xs 4) sits in a card (md 8) with 4px+ of inset. CTA grammar: **rect**.

Lines: 1px Rules everywhere; the tether is 1.5px (2px when selected) with a 6px Tether Glow
under-stroke; the ghost outline is a 1px dashed Rule Strong (4px dash, 3px gap). Icons: Lucide,
16px, 1.5px stroke, Ink Muted.

## Components

### Popup (380 × up to 560)

Structure, top to bottom:
1. **Header** (48px): wordmark "Catchline" (Label, Ink), hostname (Caption, Ink Subtle, truncated
   middle), and the per-site toggle "On this site" (toggle-on/off) at the right.
2. **Rollup ledger** (the hero of the popup): the count as H2 with Mono figures ("7 catches"), then
   label/value rows: Money (`$35` activation, `$10/mo` after 12 months), Time (`36` months), Rates
   (`19.24%-29.99%` after intro), Requirements (autopay, new line, credit approval). Labels Ink Muted
   left, values right-aligned, figures in Mono figure. No middle-dot strings: one term per row.
3. **Catch list**: catch rows (claim text on line 1, up to three chip labels on line 2, confidence
   tag right). Selected row: Sheet 2 plus a 2px Prussian left indicator. Uncounted reference
   footnotes collapse under "Other footnotes (4)".
4. **Footer** (48px): primary "Show all on page" with keycap `Alt Shift C`; ghost "Options".

| State | Trigger | What renders | Copy |
|---|---|---|---|
| Loading | Scan in progress or rollup not yet written | After 150ms: skeleton of header, three ledger rows, three catch rows (exact boxes); kept ≥ 300ms | none (skeleton) |
| Empty | Scan finished, zero markers | Ledger replaced by one sentence and a secondary action | "No fine print on this page. Catchline checks every page for *, †, ‡ and ¹ claims, and the badge shows a count when it finds one." Action: "Open welcome page" |
| Only reference footnotes | Markers found, none counted | Count "0 catches", list shows "Other footnotes (n)" expanded | "These footnotes don't mention fees, terms or conditions." |
| Success | ≥ 1 counted catch | Full ledger and list; primary button enabled | "7 catches" |
| Disabled on site | Toggle off | Ledger hidden; toggle off | "Catchline is off on example.com. Turn it on to scan this page." |
| Restricted | `chrome://`, store, PDF viewer | Single sentence | "Browsers don't let extensions read this page." |
| Permission needed (Firefox) | Host permission not granted | Warning panel with primary button | "Catchline needs permission to read pages to find fine print." Button: "Allow on all sites" |
| Error | Scanner not reachable (tab opened before install) or scan threw | Danger panel with action | "Catchline can't reach this page yet. Reload the page to scan it." Button: "Reload page" |

### Marker hit target (overlay, every page when "Mark catches on page" is on)

A transparent 24×24px minimum hit box centered on the marker glyph inside Catchline's shadow layer
(the host page is untouched), with a 2px Prussian underline under the glyph only.
- Rest: underline at 40% opacity. Hover (pointer: fine): 100% opacity, tooltip "Show the catch"
  after 500ms. Focus-visible: 2px Prussian outline, offset 2px, radius full. Open: 2px Prussian ring
  around the glyph. Off setting: nothing drawn; markers still open from the popup and Show all.

### Catch card (overlay, 336px)

Anatomy, top to bottom: claim (H3, Ink, the claim text as the page prints it, marker included);
confidence tag at top right; chips (wrapping row, 6px gaps); the fine print (Fine print text in a
Ledger Paper block with e1 ring, the chips' spans highlighted with Prussian Wash); actions row (ghost
buttons "Copy text", "Save image", "Go to footnote"; icon buttons have `aria-label` and tooltip with
shortcut).

**Chip:** Sheet 2, xs radius, 24px tall, Label text; a 16px Lucide glyph per kind in Ink Muted
(money: `banknote`, time: `calendar-clock`, rate: `percent`, requirement: `list-checks`,
exclusion: `circle-slash`, renewal: `repeat`); figures inside chips in Mono figure. Max 6 chips,
then "+3 more" (Caption) which expands.

| State | What renders | Copy |
|---|---|---|
| Opening | The signature flight (below), then the card | none |
| Matched (confidence ≥ 0.8) | Full card; tag "Matched" with a check icon | "Matched" |
| Likely (0.45-0.8) | Full card; tag "Likely match" in Ink Muted with info icon; tooltip lists signals in words | "Likely match. Same † symbol in the page's legal section, 2 candidates." |
| Many-to-one | Chosen sentence only, then a disclosure | "Show all offer details (612 words)" / "Show less" |
| No footnote found | Claim, then a Sheet 2 panel; no chips; ghost "Search the page" (scrolls to the legal section if any) | "No footnote found for this *. The terms may be in an image or on another page." |
| Terms on another page | Claim, link chip with host and path, fine print if any | "Terms are on another page: carrier.example/legal/offer-details" |
| Loading | Footnote container detected but empty (lazy drawer); skeleton lines for 2s max, then Not found | "Looking for the footnote…" |
| Error | Card failed to measure or render | "Catchline couldn't place this card. Open it from the popup instead." |
| Success (actions) | Inline morph on the button: icon crossfades to a check, label "Copied" / "Saved", 1.5s, then back | "Copied", "Saved catchline-carrier-example-2026-10-20.png" |

### Tether (overlay)

SVG cubic bezier from the marker's right edge to the card's nearest edge midpoint; control points
offset horizontally by 40% of the distance so the line leaves and arrives horizontally. 1.5px
Prussian stroke over a 6px Tether Glow stroke, round caps, a 4px Prussian dot at the claim end.
States: drawing (stroke-dashoffset from full length to 0), idle, selected in Show all (2px, glow
opacity ×1.3), dimmed in Show all when not selected (stroke 40% opacity, no glow).

### Ghost outline

While a card is open, the footnote's original location carries a 1px dashed Rule Strong outline
(4px inset, xs radius) drawn in Catchline's layer, so scrolling down shows where the fine print came
from. Removed when the card closes.

### Show all rail

Scrim over the page with cutouts around counted claims (4px padding, xs radius); tethers fan from
each claim to its rail entry; the rail header reads "7 catches on this page" with keycaps `J` `K`
`Enter` `Esc` in a hint bar (bible M9: the keycap depresses for 120ms when its key is pressed).
Entries are compact cards (claim line + chips; Enter expands to the full card in place).
- Loading: same skeleton rules as the popup. Empty: rail shows "No catches on this page." and exits
  after 1.5s or on Esc. Error: "Couldn't draw all catches. Try again from the popup." with "Close".

### Share card (PNG, 1200 × 630)

Ledger Paper canvas, 64px margins. Left 60%: the claim at 64px Schibsted 600, -0.03em, with its
marker. Right 40%: the card at 1.5× scale (chips and the fine print). A Prussian tether joins them.
Footer row: hostname and capture date (Mono figure, Ink Subtle) left, "Catchline" wordmark right. No
host-page screenshot, no logos of the merchant.

### Options page (720 max)

Sections, each an H3 with a one-line explanation and controls: Where Catchline runs (radio: "On every
page (shows a count in the toolbar)" / "Only when I click the toolbar button"), Sites turned off
(list with Remove; empty: "No sites turned off. Turn Catchline off for a site from the popup."),
On the page (toggle "Mark catches with a thin underline"), Motion ("Follow system" / "Reduce motion
always"), Theme (System / Light / Dark segmented), Plain-language line (off; explains on-device only
and availability), Accuracy (the measured corpus numbers per family with the commit they came from,
or "Not yet measured"), Keyboard shortcuts (table with keycaps; link "Change in browser settings"
opens `chrome://extensions/shortcuts`), Privacy ("Catchline makes no network requests. Settings stay
in this browser.").
- Loading: skeleton per section after 150ms. Saving: changes apply instantly; status text "Saved"
  with time in the page header (not a toast). Error: inline danger text under the control "Couldn't
  save. Your browser's extension storage is full or unavailable." with "Try again".

### Welcome page (once, on install)

Specimen page on the left, framed (lg radius, e1 ring) and labeled "Specimen page. Not a real offer.";
on the right three real steps: "Click any * on a page", "Read the catch next to the claim", "Press
Alt Shift C to see every catch". The specimen runs the real overlay. Firefox: a warning panel
"Allow Catchline to read pages" with primary "Allow on all sites" before the steps; success state
"Allowed. Open any offer page to try it."

### Landing page

Components and states are specified in `docs/LANDING.md`; tokens are the same. One filled primary
per band ("Add to Chrome" or "Add to Firefox" for the detected browser; the other is a text link).
States: no-JS (static docked frame), reduced motion (docked, no flight), store listing pending ("Store
review pending. Build it from source in two commands." with the commands), corpus not measured
("Accuracy: not yet measured").

## Signature Moment: the footnote flight

**Event:** the first card opened on a page (by click, Enter or the popup). It is rare by design
(once per page load); later opens on the same page use the short version. Keyboard stepping in Show
all never animates (bible P1).

**Full version, frame by frame** (total 960ms; the bible's 300ms ceiling is waived only here):

| t (ms) | What happens | Property, easing |
|---|---|---|
| 0 | Input. Marker ring appears at full strength; claim gets Prussian Wash highlight | opacity 0→1, 0ms (instant feedback) |
| 0-120 | Lift off: a clone of the footnote block rises 4px and scales 1→1.02; e4 shadow fades in. A dashed ghost outline appears at the original spot | transform, opacity; `--ease-out` |
| 80-560 | Flight: the clone travels along the tether path (CSS `offset-path` = the bezier, `offset-distance` 100%→0%), scaling from its original font size up to 13px reading size (for a 9px footnote, scale 1→1.44). The tether strokes in behind it (dashoffset), from the footnote end toward the claim | offset-distance, transform; `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`, 480ms |
| — | If the footnote is off-screen, the path starts at the viewport edge nearest the footnote, at the footnote's x; a Mono figure tag "3,140 px below" rides at the path start for the flight | same |
| 560-680 | Dock: the clone cross-fades into the real card (card scale 0.96→1, opacity 0→1; clone opacity 1→0). Tether glow pulses once: glow opacity 0.22→0.40→0.22 | SPRING.ui (visualDuration 0.25, bounce 0.05), 120ms crossfade |
| 680 / 760 / 840 | Chips pop in one by one (max 4 animated; the rest appear with the 4th): opacity 0→1, scale 0.9→1, y 4→0 | SPRING.playful (visualDuration 0.4, bounce 0.25), 80ms stagger |
| 840-960 | Fine print block fades in under the chips; focus moves to the card's heading | opacity 150ms `--ease-out` |

**Interruptions:** Esc or a click outside during flight jumps to the end state, then closes (Esc) or
stays open (click on the card). Scrolling during flight recomputes the path every frame from live
rects. Opening another marker mid-flight finishes the current one instantly.

**Short version** (later opens on the same page): card opacity 0→1 and scale 0.96→1 from the marker
side (`transform-origin` at the marker), 150ms `--ease-out`; tether draws in 120ms; chips appear
together; ghost outline appears with no animation.

**Reduced motion** (`prefers-reduced-motion: reduce` or the Options override): no clone, no flight,
no scale. Card and tether fade in together over 150ms; chips appear together; ghost outline static.

**Capture:** every step is WAAPI, so the demo GIF/MP4 is captured deterministically by pausing all
animations and seeking `currentTime` frame by frame (adapting the studio prerender kit's
`window.__frame(i)` idea to WAAPI).

## Motion Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-0` | 0ms | J/K, popup open, keyboard actions |
| `--dur-1` | 100ms | Hover/press color, focus ring |
| `--dur-2` | 150ms | Tooltip, short card open, reduced-motion fades, copy morph |
| `--dur-3` | 200ms | Popover and menu enter, toast exit |
| `--dur-4` | 250ms | Disclosure expand ("Show all offer details") |
| `--dur-5` | 300ms | UI ceiling |
| `--dur-flight` | 480ms | Signature flight segment only |
| `--dur-signature` | 960ms | Whole signature moment only |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Default enter/exit |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | On-screen A→B (the flight) |
| `--ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | Rail bottom sheet on narrow viewports (500ms enter / 300ms exit) |
| `--ease-scene` | `cubic-bezier(0.65, 0.05, 0, 1)` | Landing page scene moves only |
| `SPRING.snappy` | `{ visualDuration: 0.18, bounce: 0 }` | Toggle thumb, selection indicator |
| `SPRING.ui` | `{ visualDuration: 0.25, bounce: 0.05 }` | Card dock, popovers |
| `SPRING.playful` | `{ visualDuration: 0.4, bounce: 0.25 }` | Chip pop in the signature moment only |

Hover changes color only (100ms). Buttons press to `scale(0.97)`. No `transition: all`. Everything
is interruptible (CSS transitions or WAAPI, never awaited before committing state).

## Shortcut Map

| Where | Keys | Action |
|---|---|---|
| Browser (manifest `commands`) | Alt+Shift+C | Show all catches on this page |
| Browser | Alt+Shift+K (suggested `_execute_action`) | Open the popup |
| Card | Esc | Close card, focus returns to the marker hit target |
| Card | C / S / G | Copy text / Save image / Go to footnote |
| Show all | J / K | Next / previous catch (0ms, scrolls claim into view) |
| Show all | Enter | Expand the selected entry into a full card |
| Show all | Esc | Exit, restore scroll position |
| Show all | ? | Shortcut sheet |
| Popup | ↑ / ↓, Enter | Move in the catch list, reveal the catch on the page |
| Popup | A | Show all on page |

Single-key shortcuts are active only while Catchline's overlay has focus and never while a host page
input or contenteditable is focused. **Command palette:** deliberate deviation from bible §6.8. The
popup is itself a short command list and the overlay has five actions, so a cmdk palette would add a
surface without adding reach; every action is reachable by mouse and by the keys above.

## Landing Page 3D / Immersive Plan (bible §11)

**Decision: CSS/SVG only, no WebGL.** By the bible's decision rule (§5.2 of 3D_INSPIRATION), live
WebGL needs a T-pattern that says something a flat version cannot. Catchline's idea is a line between
two points in a document: it is flat by nature, and the real engine already draws it in SVG.
Spending 260KB on a 3D object would put a metaphor where the product can demonstrate itself.

- **Hero (T1 poster-first, adapted):** the real overlay engine running on a specimen promo page
  (synthetic and labeled), rendered in DOM and SVG. The LCP element is the H1; the specimen paints as
  static HTML with the card already docked (that frame is the poster and the no-JS state). After
  `load` + idle, the engine resets the card and plays the flight once, then stays still. A "Replay"
  button replays it. Under reduced motion it stays docked.
- **Atmosphere:** T16 contour backdrop as a static SVG (≤ 30KB, `currentColor` at 6% on Ledger
  Paper), suggesting the ruled ledger. No grain, no gradients.
- **Pre-rendered loops (T18):** README GIF (≤ 3MB, 800-960px, ≤ 6s), LinkedIn MP4 1:1, OG card PNG
  1200×630, all captured deterministically from the e2e harness via WAAPI seeking, encoded with the
  studio's tested ffmpeg commands.
- **Budgets:** initial JS ≤ 120KB gz; no 3D chunk; LCP ≤ 2.0s mid-tier mobile; CLS 0.

## Do's and Don'ts

### We never (bible P8)
1. **We never hide the merchant's words.** Every card shows the original footnote text (or the chosen
   sentence with its full-text expander). Chips summarize; they never replace.
2. **We never move the host page.** Nothing Catchline draws enters the page's layout flow; all UI
   lives in fixed or absolute shadow-root layers, and the page's scroll position is restored after
   Show all.
3. **We never use a second color to judge a catch.** One accent (Prussian) for the line, focus and
   the primary action; no red, amber or green on offers, no scores, no "bad deal" language.

### Do
- Do set every money amount, duration, rate and offset in Commit Mono with `tnum`.
- Do keep one filled Prussian button per view; secondary actions are Sheet or ghost buttons.
- Do show confidence in words ("Matched", "Likely match") with the reason one hover away.
- Do write states as what happened plus what to do next, in sentence case, with no apology.
- Do keep cards inside the viewport with 16px margins and clear of sticky headers.
- Do use px units inside every shadow root.

### Don't
- Don't use pills for buttons or chips (toggle tracks are the only full-radius shapes).
- Don't use all-caps labels, eyebrows above headings, middle-dot meta strings, or `→` on buttons.
- Don't put Ink Subtle text on Sheet 2 in light mode.
- Don't animate J/K, popup open or any keyboard-triggered action.
- Don't use gradients, glass, emoji or illustrations in product UI.
- Don't show stars, install counts, testimonials or accuracy numbers that CI has not measured.

## Appendix B Pre-flight Checklist (ticked)

- [x] Archetype (§10.3) and blend notes, with what was rejected: A6 extension popup with A3
      discipline; stripe, linear.app, theverge blend in Overview → Blend notes.
- [x] Direction: D3 Prussian Ledger (assigned), with two additions (Tether Glow, Prussian Ink dark at
      L 0.80 for text use), re-checked against §4.4: ΔE_OK 0.113 (light) and 0.130 (dark).
- [x] Pairing: T1 Schibsted Grotesk + Commit Mono (assigned); Compact scale; features `tnum` on
      figures, `font-synthesis: none`, balance/pretty wrapping.
- [x] Radius personality Standard (4/6/8/12); CTA grammar rect; theme default light-first,
      following system.
- [x] Three "we never" constraints: Do's and Don'ts → We never.
- [x] Signature moment: the footnote flight (custom), on the first card opened per page; supporting
      M9 tactile keycaps in the Show all hint bar.
- [x] Shortcut map and command list: Shortcut Map (cmdk deviation stated with reason).
- [x] Empty, loading, error and success copy for every primary screen: popup, card, rail, options,
      welcome, landing (Components).
- [x] Target platforms and their §8 constraints: Chrome MV3 + Firefox MV3 desktop; popup 380 wide
      ≤ 560 tall, first paint ≤ 100ms, Shadow DOM with z 2147483647, local fonts, badge ≤ 4 chars.

§11.10 additions:
- [x] The one sentence the 3D says: none; reasoned CSS/SVG-only choice (Landing Page 3D plan). T16
      static SVG and T18 pre-rendered loops only.
- [ ] Poster, loop and OG card rendered via the capture approach: build stage (not yet produced).
- [x] `size-limit` entries specified: ADR 0001 §6 (landing initial ≤ 120KB; no 3D chunk).
- [ ] Tier 0 / reduced-motion / no-WebGL screenshots: build stage (reduced-motion and no-JS
      screenshots of the landing hero; there is no WebGL tier).
