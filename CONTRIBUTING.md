# Contributing to Catchline

Thanks for helping. Catchline is small on purpose: a deterministic engine, a thin extension around
it, and no network. Contributions that keep it that way are very welcome.

## The most useful contributions

1. **A page where Catchline gets it wrong.** Open a bug with the claim, the footnote it should have
   matched, and what it showed instead. Please do not attach a copy of a company's page. Instead,
   write a short fictional page that reproduces the pattern (same markup shape, invented company
   and wording) and add it to the issue. `tests/fixtures/README.md` describes how the existing
   fixtures are written.
2. **A missing chip.** Paste the footnote sentence and the chip you expected ("$10 SIM kit fee"
   should give a money chip). Extractor rules live in `src/core/extract/rules/` with table tests
   in `tests/unit/extract/`.
3. **Accessibility and keyboard problems** on the card, Show all, the popup or the options page.

## Set up

Node 22 or newer and pnpm 10.

```
pnpm install
pnpm exec playwright install chromium   # once, for the e2e tests
pnpm build                              # load .output/chrome-mv3 at chrome://extensions
pnpm test
```

Run the engine on one HTML file without a browser:

```
pnpm engine path/to/page.html           # add --all to list uncounted markers too
```

## Rules the code follows

- **No network.** Nothing in the extension or the web app may make a request. ESLint forbids the
  primitives and `pnpm check:network` scans the build. There is no analytics and there will not be.
- **`src/core` is pure.** No `chrome.*`, `browser.*`, `window` or `document` globals, and no imports
  from outside `src/core`. The web app in `site/` imports the same engine.
  `tests/unit/guards/core-boundary.test.ts` enforces this.
- **Deterministic extraction.** Rules are ordered regular expressions with a test row each. A wrong
  match must never hide the merchant's own text: the footnote is always shown under the chips.
- **Fictional brands only** in fixtures, screenshots and docs. Links use the `.example` domain.
- **Design tokens come from `DESIGN.md`.** No new colours or font sizes in components.
- Bundle sizes have ceilings (`pnpm check:size`). If you make a bundle smaller, lower its ceiling in
  `scripts/check-size.mjs` in the same change.

## Before you open a pull request

```
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e                           # builds, then runs Playwright against the extension
```

If you touched `site/`, also run `pnpm test:site` and `pnpm --dir site test:e2e`.

`docs/TESTING.md` maps every acceptance criterion in `SPEC.md` to its tests, and
`tests/unit/guards/ac-coverage.test.ts` fails when a criterion has no test. If you change behaviour
a criterion describes, update the test and the matrix together.

Keep pull requests focused: one fix or feature, with a test that fails without it. Describe what you
checked by hand (browser, page, light or dark, reduced motion) in the PR template.

## Firefox

Playwright cannot load Firefox add-ons, so Firefox changes are checked by hand. Build with
`pnpm build:firefox`, then load `.output/firefox-mv3/manifest.json` from
`about:debugging#/runtime/this-firefox`. The checklist is in `HANDOFF.md`.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By taking part you agree to it.
