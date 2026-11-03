# Catchline landing page

Mode: **Persuade**. Tokens, type and motion come from `DESIGN.md`; this file covers narrative, hero
concept and copy. Structure: five beats in at most 7 viewports (desktop
900px tall). No WebGL (DESIGN.md, Landing Page 3D plan).

Truth rules for every line below:
- No install counts, stars, testimonials, press or user numbers. None exist.
- The accuracy figure is read from `corpus/report.json` at build time. If it has not been measured,
  the page says "Accuracy: not yet measured" and links to the corpus folder.
- Every specimen page is synthetic, says so on screen, and uses no real merchant's name or logo.
- Store buttons link to real listings only once they exist; before that, the install beat shows
  build-from-source commands and says the listing is pending.

## Hero concept: "The catch, next to the claim"

The first viewport is the product working, at poster scale.

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Catchline                                      How it works   Source   [Add] │  56px nav
 │                                                                              │
 │  The catch,                      ┌─ Specimen page. Not a real offer. ──────┐ │
 │  next to                         │  Unlimited plan                         │ │
 │  the claim.                      │  $0/mo* ─────────╮   ┌───────────────┐  │ │
 │  (hero, 120px)                   │  Unlimited¹      ╰──▶│ $0/mo*        │  │ │
 │                                  │                      │ [$35 activ.]  │  │ │
 │  Catchline matches every *, †    │                      │ [36-month]    │  │ │
 │  and ¹ on a page to its          │                      │ [Autopay req.]│  │ │
 │  footnote and lists the fees     │  ......              │ fine print... │  │ │
 │  and conditions next to the      │  *With 36-month ins… └───────────────┘  │ │
 │  claim. Free. Nothing leaves     │  (ghost outline, 9px)                   │ │
 │  your browser.                   └─────────────────────────────────────────┘ │
 │  [Add to Chrome]  Add to Firefox                                  Replay ⟲  │
 └──────────────────────────────────────────────────────────────────────────────┘
```

- **Left (5 of 12 columns):** H1 at the hero size (DESIGN.md `hero`, 56-120px, 600, line-height
  0.92, -0.035em), set ragged in three lines. Under it, the lead paragraph (16/24) and the CTA row:
  one filled Prussian button for the detected browser, a text link for the other.
- **Right (7 of 12 columns):** a framed specimen promo page (lg radius, e1 ring, Ledger Paper top bar
  with the label "Specimen page. Not a real offer."), running the real overlay engine. The poster
  frame (server HTML) shows the card docked and the tether drawn; that is the LCP-safe, no-JS and
  reduced-motion state.
- **The one moment:** after `load` plus idle, the engine resets the card and plays the signature
  flight once: the 9px footnote at the bottom of the specimen lifts off, flies up the glowing tether
  and docks; chips pop in. Then the page is still. "Replay" (bottom-right of the frame, 32px icon
  button with label) plays it again.
- **Background:** Ledger Paper with the static T16 contour SVG at 6%, only behind the right column.
- **Mobile (375):** H1 at 56px, lead, CTA, then the specimen frame full width at 4:5 with the card
  docked below the claim instead of beside it.

The muted 3-second test: with no sound and no scroll, a viewer sees a footnote
fly up to "$0/mo*" and turn into three cost chips. That is the whole pitch.

## The five beats

### Beat 1. Hook (viewport 1)

- H1: **The catch, next to the claim.**
- Lead: "Catchline matches every *, † and ¹ on a page to its footnote and lists the fees and
  conditions right next to the claim. Free and open source. Nothing leaves your browser."
- Primary: "Add to Chrome" (or "Add to Firefox" on Firefox). Secondary text link: the other browser.
- Under the CTA, Caption in Ink Subtle: "Works on Chrome, Edge and Firefox on desktop."

### Beat 2. The real product in motion (viewport 2)

A pre-rendered loop (T18, MP4 + WebM, poster frame, `muted playsinline loop preload="none"`, played
when 25% visible, paused when hidden, Pause button since it loops past 5s) captured from the e2e
harness: the toolbar badge reading `3`, the popup ledger opening ("3 catches: $35 + 36 months
hidden"), then Show all: the page dims and three tethers fan out to the rail; J steps through them.

- H2: **Every page, checked before you read it.**
- Body: "Catchline scans each page as it loads. When it finds fine print attached to a price, a rate
  or a promise, the toolbar shows how many catches it found and what they add up to."

### Beat 3. Three proof moments (viewports 3-5, one each)

Each is a 4-6s loop of the real UI on a synthetic specimen, with one line of copy. Left/right
alternates; no cards grid.

1. **One asterisk, fourteen claims.**
   "Some pages hang one * on every claim and point it at a 600-word block. Catchline picks the
   sentence that belongs to each claim and keeps the full text one click away."
   Loop: three claims on a SaaS pricing specimen tether to three different sentences of the same
   block; "Show all offer details (612 words)" expands.
2. **When it can't tell, it says so.**
   "Each match shows how sure it is. If there's no footnote to find, the card says that instead of
   guessing."
   Loop: a "Likely match" card with its reason on hover, then a "No footnote found" card on an
   airline specimen whose fine print is an image.
3. **From 0% APR to 50% off.**
   "Phone plans, credit cards, sales, streaming trials, software pricing and airfares. Fees, terms,
   rates, renewals and exclusions become plain chips; the merchant's own words stay underneath."
   Loop: chips appearing on a card offer ("15 months at 0%", "Then 19.24%-29.99%", "3% transfer
   fee"), then a retail sale ("Excludes clearance", "Online only").

### Beat 4. The how (viewport 6)

H2: **How it works, in your browser.** An SVG diagram (DOM text, not an image of text), four steps
left to right with a number in each step, matching the README:

1. **Find:** "Scans text for *, †, ‡, §, ¶ and superscript numbers, and skips prices like
   $49<sup>99</sup>, math and code."
2. **Match:** "Follows linked footnotes first, then looks bottom-up through the page's legal and
   fine-print sections for the same symbol."
3. **Extract:** "Pulls out money, time, rates, requirements, exclusions and renewals with fixed
   rules. No AI and no account."
4. **Draw:** "Draws the line and the card in its own layer, so the page itself never moves."

Beside the diagram, the accuracy panel, generated from `corpus/report.json`:
"Tested on 30 saved offer pages in CI. Pair precision {p}%, recall {r}% (commit {sha})." with a
per-family table, or "Accuracy: not yet measured" before the first run. Below it, the privacy line:
"No network requests. No analytics. Settings stay in your browser."

### Beat 5. Install (viewport 7)

- H2: **Add it once. It checks every page after that.**
- Store buttons (Chrome Web Store, Firefox Add-ons), or while review is pending: "Store review
  pending. Build it from source:" followed by a copyable mono block:
  ```
  pnpm install
  pnpm build            # Chrome: load .output/chrome-mv3 as an unpacked extension
  pnpm build:firefox    # Firefox: .output/firefox-mv3
  ```
- Line: "Open source under the MIT license." with a text link to the repository (no star badge with
  a fabricated count; a live shields.io badge is allowed only once the repo is public, and it would
  be the page's one external request, so it is left out by default).
- Footer: "Catchline doesn't read fine print inside images, and it doesn't open separate terms pages
  yet." Then repository, license, privacy.

## Copy notes

- Voice: plain, specific, a little dry. It states what the page says and never calls a merchant a
  liar.
- Sentence case everywhere; no eyebrows, no all-caps, no `→` on buttons.
- Numbers on the page (14 claims, 612 words, 0% APR, 3,140 px) come from the specimen pages and are
  labeled synthetic in the frame; the only measured number is the corpus result.
- `<title>`: "Catchline: the catch, next to the claim". Meta description: "A free browser extension
  that matches *, † and ¹ to their footnotes and lists the fees and conditions next to the claim.
  Runs entirely in your browser."
