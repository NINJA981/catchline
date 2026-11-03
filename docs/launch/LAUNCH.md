# Catchline v0.1.0 launch kit

Everything here was produced from the real built extension (`pnpm build`, Chrome) on the fictional
"Ridgeline Mobile" specimen page (`tests/fixtures/synthetic/carrier-specimen.html`), captured with
Playwright by `scripts/launch-assets.mjs`. Rebuild them with:

```
pnpm build && pnpm zip && pnpm zip:firefox
node scripts/launch-assets.mjs
```

## Files

| File | Size | Use |
|---|---|---|
| `catchline-0.1.0-chrome.zip` | 777 kB, `pnpm zip` | Chrome Web Store upload; "Load unpacked" after unzipping |
| `catchline-0.1.0-firefox.zip` | 778 kB, `pnpm zip:firefox` | AMO upload; temporary install |
| `catchline-0.1.0-sources.zip` | 388 kB, `pnpm zip:firefox` | AMO source submission (the build is bundled) |
| `hero.gif` | 960 px wide, 4 s, 358 kB | README hero, the signature moment |
| `store-1-card.png` | 1280 x 800 | Store screenshot 1 |
| `store-2-show-all.png` | 1280 x 800 | Store screenshot 2 |
| `store-3-popup.png` | 1280 x 800 | Store screenshot 3 (the popup drawn over the page where it opens) |
| `social-preview.png` | 1280 x 640 | GitHub: Settings, Social preview |

Building the AMO sources zip into an identical package needs Node 22+, pnpm 10.34.6 and
`pnpm install --frozen-lockfile && pnpm zip:firefox` (see the README's Development section).

### Alt text

- **hero.gif:** "A fictional phone carrier page offering a phone for $0/mo*. The asterisk is
  clicked; the small footnote at the bottom of the page lifts off, flies up along a curved line and
  docks beside the price as a card with three chips: $35 activation, 36-month installment
  agreement, Autopay required."
- **store-1-card.png:** "Catchline's card docked beside "$0/mo*" on a fictional carrier page,
  listing $35 activation, 36-month installment agreement and Autopay required above the
  footnote's own words."
- **store-2-show-all.png:** "Show all: the page is dimmed and three claims are tethered to a rail of
  cards on the right, one per catch."
- **store-3-popup.png:** "The Catchline popup over the page: 3 catches, $35 + 36 months hidden,
  with the list of claims."
- **social-preview.png:** "Catchline. The catch, next to the claim. Beside it, the card docked
  next to a $0/mo* offer."

## LinkedIn post (draft)

Under 1,300 characters. Attach `hero.gif` (or a screen recording of the same moment) natively; put
the repository link in the post or the first comment (see the playbook's note on link reach).

> Every asterisk on the internet is a promise with a catch 3,000 pixels below it. I built an
> extension that drags the catch back up to the promise.
>
> "$0/mo*". The asterisk leads to 11-pixel text at the bottom of the page, past the plans, the FAQ
> and the footer links. So I built Catchline.
>
> Click the asterisk and the footnote flies up beside the claim, as plain chips:
> - "$35 activation", "36-month installment agreement", "Autopay required"
> - It finds *, †, ‡, §, superscript numbers and "Terms apply", even when the footnote hides in a
>   collapsed accordion
> - Alt+Shift+C shows every catch on the page at once
>
> No AI, no account, no server: it runs entirely in your browser and the build is checked to
> contain no network code.
>
> Not yet: it is not in the Chrome Web Store, Firefox is untested beyond the build, and I have not
> measured its accuracy on real sites. Saved pages that trip it up are the best bug reports.
>
> Free and open source (MIT): [repository link]
>
> #opensource #browserextension #privacy

**Claims check (every line traces to the repo):**

- "3,000 pixels" in the hook is a figure of speech, not a measurement. If you want only literal
  claims, use: "Every asterisk on the internet is a promise with a catch at the bottom of the page."
- "11-pixel text": the specimen's footer is `font-size: 11px`; describe it as the specimen, not as
  every site.
- Chips: shown in `store-1-card.png`, produced by the extractor on the specimen.
- Marker forms and accordions: `src/core/scan`, `tests/fixtures/synthetic/glyphs.html`,
  `hidden.html`.
- "No network code": `pnpm check:network`, the ESLint network rules, and the e2e request log
  (`tests/e2e/privacy.spec.ts`).
- Limits: README "Limitations".

## Chrome Web Store listing

- **Name:** Catchline
- **Summary (132 characters max):** Pulls the fine print up next to the claim: matches every *, †
  and ¹ to its footnote and lists the fees. No network.
- **Category:** Productivity (or Shopping)
- **Description:**

  Catchline finds the footnote markers on a page (*, †, ‡, §, ¶, superscript numbers and phrases
  like "Terms apply"), matches each one to its footnote, and shows the conditions next to the
  claim as plain chips: fees, contract lengths, rates, requirements, exclusions and renewals. The
  footnote's own words are always shown under the chips.

  - Click a marker: the footnote flies up and docks beside the claim.
  - Alt+Shift+C: see every catch on the page, step through them with J and K.
  - The toolbar badge counts the catches; the popup lists them.
  - Save any catch as an image to share.

  Catchline makes no network requests, has no account and no analytics, and stores only your
  settings and per-tab counts. It is free and open source (MIT).

- **Single purpose:** Show the footnote and the conditions a page attaches to a claim next to that
  claim.
- **Permission justifications:**
  - Host permission (all sites): the scanner runs on each page to count footnoted claims for the
    toolbar badge. Users can switch to click-only mode in Options.
  - activeTab: run on the current tab after a click or shortcut.
  - scripting: inject the card overlay only when the user opens a card or Show all.
  - storage: save settings and the per-tab counts the popup shows.
- **Remote code:** No.
- **Data usage:** collects no user data. Nothing leaves the browser.
- **Privacy policy URL:** needed by the dashboard; point it at the README's Privacy section once
  the repository is public.
- **Icon:** the 128 x 128 icon from the build.

## Firefox Add-ons (AMO) listing

- Same name, summary and description.
- Upload `catchline-0.1.0-firefox.zip` and, when asked about source code, `catchline-0.1.0-sources.zip`.
- `browser_specific_settings.gecko.id` is `catchline@catchline-extension`; minimum Firefox 140
  (desktop) and 142 (Android); `data_collection_permissions: none`.
- Before submitting: run the manual Firefox checklist in `HANDOFF.md`. It has not been run yet.
