# Product

<!-- impeccable:product-schema 1 -->

> Inferred record. Written at Stage 1 (architect) from the studio brief (`_studio/picks.json` entry
> `catchline`, council transcript `L18-3-catchline.md`) with no live user interview available, and
> re-verified against that brief on 2026-10-20 after an aborted earlier run. Every fact below traces
> to the brief; nothing was invented. Items marked **(inferred)** are the architect's reading of the
> brief and should be confirmed by the owner. Detailed scope lives in `SPEC.md`.

## Platform

web

## Stack

Delegated by the studio brief: a WXT browser extension, Chrome MV3 first with a Firefox MV3 build,
React + Tailwind v4 + Radix + Motion per the studio design bible. Exact versions live in
`docs/adr/0001-architecture.md`.

## Users

- People reading a deal, plan comparison, pricing or promo page on a desktop browser: phone and
  broadband plans, credit card and bank offers ("0% APR†"), retailer sales ("Up to 50% off*"),
  streaming plans, SaaS pricing tables, airline fares.
- The job: before committing money, find out what the asterisk is hiding without scrolling 3,000px
  to a 9px footnote and guessing which footnote belongs to which claim.
- Secondary audience **(inferred)**: people who share "look at the catch" screenshots with friends
  or on social media.

## Product Purpose

Catchline pulls the fine print up to the claim it qualifies. Every `*`, `†`, `‡`, `§`, `¶`,
superscript number or "Terms apply" phrase on a page gets matched to its footnote, and the footnote's
conditions are condensed into plain cost chips ("$35 activation", "36-month contract", "autopay
required"), with the original footnote text always shown underneath.

Success: on a promo page, the user sees the hidden money and time terms in one glance (toolbar badge)
and can read any single catch in one click, and a wrong match never hides the original text.

## Positioning

It matches **unlinked** commerce footnote markers to footnote blocks far down arbitrary pages with no
cooperation from the page author, then extracts the conditions deterministically. Prior art
(littlefoot, Bigfoot, Footnotify 2011, Wikipedia tooltips) only handles href-to-id linked footnotes
and does not extract conditions. No AI and no API key are needed for the core.

## Operating Context

- Runs passively on every page as a content script; it is noticed through the toolbar badge. The
  badge counts only commerce catches (money, time, rate, requirement, exclusion or renewal terms),
  so plain reference footnotes on articles never inflate it.
- The moment of use is a purchase decision on desktop: comparing plans, about to check out.
- Mobile Chrome has no extensions. Firefox Android and Safari builds are v2.

## Capabilities and Constraints

- Core is deterministic and local: marker scanner, two-stage matcher with confidence, many-to-one
  sentence matching, regex catch extractor, tether overlay, show-all mode, badge rollup, share PNG.
- No hosted backend, no telemetry, no network calls by default. Settings and per-site state live in
  `chrome.storage.local`.
- Out of scope: fine print inside images (no OCR), and separate /legal pages (shown as a link chip;
  a same-origin fetch is v2).
- Matching accuracy is measured on a committed fixture corpus of saved promo pages; the match rate is
  published in the README. It is a number, not a claim.

## Brand Commitments

- Name: Catchline (renamed from "Asterisk Hunter", which collides with the Asterisk PBX).
- Voice **(inferred from the council)**: plain, specific, a little dry; it states what the page says,
  never editorializes about the merchant.
- Never claim the merchant is lying; Catchline shows the merchant's own words next to the claim.

## Evidence on Hand

- No users, testimonials, install counts, stars or press exist yet. Future work must not fabricate any.
- The only accuracy evidence will be the CI fixture corpus match rate, once it is measured.
- Fixture pages are saved snapshots of real promo pages; screenshots of them must credit the source
  site and avoid presenting it as an endorsement.

## Product Principles

1. The original footnote text is always visible. Chips summarize; they never replace.
2. Honest uncertainty: every match shows its confidence, and an unmatched marker says "No footnote
   found" rather than guessing.
3. Local and quiet: nothing leaves the browser, and nothing on the host page moves unless the user
   asks.
4. Earn the daily glance: the badge rollup must be right enough to trust at a glance on any page.

## Accessibility & Inclusion

- Bible standard: WCAG 2.2 AA plus APCA targets in both themes, full keyboard path (J/K stepping,
  Esc closes), reduced-motion variants for the tether flight.
- Overlay text must stay readable regardless of host page styles (Shadow DOM isolation).
