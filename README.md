# Catchline

Pulls the fine print up to the claim it qualifies. Catchline finds the `*`, `†`, `‡`, `§`, `¶`,
superscript numbers and "Terms apply" phrases on a page, matches each one to its footnote (even
when the page does not link them and the text hides in an accordion), and turns the conditions into
chips: money, time, rate, requirement, exclusion, renewal.

It runs in your browser. No account, no backend, no analytics, and no network requests.

**Status: work in progress.** The engine (scanner, matcher, extractor, rollup, storage) is built and
tested. The badge rollup works in Chrome. The on-page overlay, popup ledger, options and welcome
pages are still to come. See [HANDOFF.md](HANDOFF.md) for what exists and what does not.

## Match rate

Not yet measured. The corpus of real pages (SPEC section 11) has not been captured, so there is no
precision or recall number to publish. The only fixtures today are hand-written synthetic pages
(see [tests/fixtures/README.md](tests/fixtures/README.md)), which prove the code paths, not accuracy
on real sites.

## Develop

Requirements: Node 22 or newer, pnpm.

```
pnpm install
pnpm dev              # Chrome with hot reload
pnpm dev:firefox
pnpm build            # .output/chrome-mv3 (load unpacked)
pnpm build:firefox
pnpm test             # Vitest unit and component tests
pnpm test:e2e         # builds, then runs Playwright against the built extension
pnpm lint             # ESLint + Prettier check
pnpm typecheck
pnpm check:network    # fails if the build contains a network primitive
```

Playwright needs Chromium: `pnpm exec playwright install chromium`.

## Layout

```
src/core/         the engine: pure TypeScript, DOM in and data out, no browser APIs
src/adapters/     small wrappers around browser APIs (badge, message sender)
src/storage/      settings (chrome.storage.local) and per-tab rollups (storage.session)
src/dom/          MutationObserver and font registration for the content script
src/entrypoints/  background, scanner content script, popup
src/ui/           DESIGN.md tokens as CSS variables and the Tailwind v4 theme
tests/            unit (Vitest), e2e (Playwright), fixtures
docs/adr/         architecture decisions
```

`src/core/index.ts` is the single entry point. The extension and the planned web app both import
the engine from there.

## Privacy

Catchline reads page text in memory to find footnotes and keeps two things: your settings
(`chrome.storage.local`) and per-tab counts and term strings (`chrome.storage.session`, gone when
the tab or browser closes). It stores no URLs and no page text. `pnpm check:network` and the e2e
suite check that the build makes no requests.

## License

MIT. Fonts are Schibsted Grotesk and Commit Mono (OFL-1.1), self-hosted through Fontsource.
