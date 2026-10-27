# Test fixtures: provenance

Every fixture in this folder is **synthetic**: written by hand for Catchline in October 2026 during
Stage 2 (scaffold + core). None of them was captured from, copied from or derived from a real web
page, and no network request was made to produce them.

- **Companies, products and domains are fictional.** Names such as Ridgeline Mobile, Lanternfish
  Bank, Quarry & Pine, Tidewell, Brightdesk and Kestrel Air are invented. Links use the reserved
  `.example` top-level domain (RFC 2606), so they can never resolve to a real site.
- **Structure is modeled on common patterns** of real promo and pricing pages (plan cards with a
  price block and a superscript marker, legal footers in small type, `<br>`-separated disclosure
  blocks, collapsed "Offer details" accordions, Wikipedia-style reference lists, numbered
  `<ol class="footnotes">`), because those patterns are what the matcher has to handle. The wording
  of the fine print is typical of each industry's disclosures but written from scratch.
- **Font sizes are inline** (`style="font-size: 11px"`), mirroring how the planned corpus capture
  (ADR 0001 §8) inlines computed font sizes into reduced snapshots, so the small-font signal works
  without a layout engine.
- **Specimen pages are not real offers.** The demo and welcome specimen will say "Specimen page. Not
  a real offer." in the UI (SPEC AC-F11.2).

Real-page fixtures (the 30-page corpus in SPEC §11) do not exist yet. They will live in
`corpus/fixtures/real/` with a `meta.json` recording source URL, capture date and family, and are
subject to the owner's sign-off noted in HANDOFF.md.

## Files

| File | Covers | Spec |
|---|---|---|
| `synthetic/glyphs.html` | All 7 marker forms and 5 escape-hatch phrases | AC-F1.1 |
| `synthetic/cents.html` | Cents superscripts, ordinals, trademarks, units: zero markers | AC-F1.2 |
| `synthetic/math-code.html` | Code, math, KaTeX, kbd, bullets, ratings, citations: zero markers | AC-F1.3 |
| `synthetic/linked.html` | `href="#id"`, `aria-describedby`, `aria-details`, numbered footnote list | AC-F2.1 |
| `synthetic/hidden.html` | Footnotes in a closed `<details>` and an `aria-hidden` accordion | AC-F2.3 |
| `synthetic/not-found.html` | Marker with no footnote; marker whose terms link elsewhere | AC-F2.4, ADR §4.5 |
| `synthetic/many-to-one.html` + `.expected.json` | One `*` on 14 claims, one 612-word offer block, hand labels | AC-F3.1 |
| `synthetic/reference-footnotes.html` | Wikipedia-style `[1]` references and blog endnotes only | AC-F7.2 |
| `synthetic/plan-cards.html` | Three cards, each with its own `*` footnote right below it | nearest-following |
| `synthetic/carrier-specimen.html` | Demo page (SPEC §12): `$0/mo*`, `Unlimited¹`, `$200 off†` | AC-F7.1 |
| `synthetic/bank-specimen.html` | Intro APR, bonus, annual fee, checking bonus | §4.1 bank |
| `synthetic/retail-specimen.html` | Sale, free shipping, code offer, `<br>`-separated legal block | §4.1 retail |
| `synthetic/streaming-specimen.html` | Promo price, trial, screens | §4.1 streaming |
| `synthetic/saas-specimen.html` | Per-seat pricing, usage caps, overage | §4.1 SaaS |
| `synthetic/travel-specimen.html` | One-way fares, round trip, hotel rate, resort fee | §4.1 travel |

Extractor table cases (AC-F4.1) are inline strings in `tests/unit/extract/*.test.ts`, also
hand-written.
