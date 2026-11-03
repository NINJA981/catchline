## What and why

<!-- One fix or feature. Link the issue if there is one. -->

## How I checked it

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm test:e2e` (if the extension changed)
- [ ] `pnpm test:site` and `pnpm --dir site test:e2e` (if `site/` changed)
- [ ] By hand in the browser: <!-- which browser, page, light/dark, reduced motion -->

## Checklist

- [ ] No network request, analytics or remote code added.
- [ ] `src/core` still imports nothing outside `src/core` and uses no browser globals.
- [ ] Fixtures and screenshots use fictional companies and `.example` links.
- [ ] `docs/TESTING.md` and `SPEC.md` updated if an acceptance criterion changed.
