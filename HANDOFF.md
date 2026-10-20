# Catchline handoff

Last updated: 2026-10-20, end of Stage 1 (architect).

## Status

**Nothing is built yet.** This stage produced the plan only. There is no `package.json`, no code, no
tests and no corpus. Every number in the docs that describes accuracy or performance is a target.

## What's done (Stage 1)

| File | What it holds |
|---|---|
| `SPEC.md` | Problem, users, daily trigger, the utility fix (wider triggers on six page families, badge rollup on every page, published corpus match rate), features F1-F12, non-goals, data model, platform matrix, privacy model, acceptance criteria per feature, corpus plan, 10-second demo script |
| `docs/adr/0001-architecture.md` | WXT stack with exact versions (checked with `npm view` on 2026-10-20), module layout, runtime architecture (small every-page scanner + on-demand React overlay), matching design, Shadow DOM/px/font decisions, budgets, privacy enforcement, testing and fixture strategy, optional LLM layer, action items |
| `DESIGN.md` | Google Stitch-format design system: D3 Prussian Ledger (OKLCH, light + dark), T1 Schibsted Grotesk + Commit Mono, spacing, radius, elevation, motion tokens; component specs and state copy for popup, overlay card, tether, Show all rail, share PNG, options, welcome and landing; the signature flight frame by frame; CSS/SVG-only landing plan; three "we never" rules; Appendix B checklist |
| `docs/LANDING.md` | Hero concept, five-beat narrative, draft copy, truth rules |
| `PRODUCT.md` | Impeccable product context (stale stub from an aborted run, re-verified and kept) |
| `.gitignore` | Build, test and local design-tool outputs |

## How to run it

Not runnable yet. Planned commands (ADR 0001 §2), for the build stage to create:

```
pnpm install
pnpm dev              # Chrome with HMR
pnpm dev:firefox
pnpm build            # .output/chrome-mv3  (load unpacked)
pnpm build:firefox    # .output/firefox-mv3
pnpm test             # Vitest unit + component
pnpm e2e              # Playwright with the built extension
pnpm corpus           # score fixtures -> corpus/report.json
pnpm corpus:readme    # regenerate the README accuracy table
pnpm size             # size-limit budgets
pnpm site:dev / site:build
```

## Next stage: start here

ADR 0001 "Action items" in order:
1. Scaffold with the exact pins; check TypeScript 7.0.2 works with `wxt prepare` and type-checking,
   else pin 6.0.3 and record why.
2. Spike CSS anchor positioning from a shadow-root card to a host element (Chrome and Firefox).
3. Spike the on-demand overlay injection hop (target ≤ 80 ms).
4. Write the 12 synthetic fixtures and the scorer before the matcher; then capture the 30 real pages.
5. CI: size-limit, no-network check, token check, corpus gate.

## Known issues and open decisions

- **Interactive steps were simulated.** The impeccable skill normally asks the user to confirm the
  visual direction (concept-seed roll, decision page). This stage ran as a subagent with no way to
  ask, and the studio pinned D3 + T1, so the direction was taken from the brief without a roll or
  comps. DESIGN.md was written before any UI exists; impeccable prefers writing it from the built
  world, so the build stage should re-check it against the real UI and update it (no
  `.impeccable/design.json` sidecar was written).
- **TypeScript 7.0.2** is the npm `latest`; WXT declares `typescript >=5.4` but tool compatibility
  with the 7.x native compiler is unverified.
- **CSS anchor positioning across the shadow boundary** is unverified; the measured-geometry
  fallback is required regardless (ADR 0001 §5.4).
- **Firefox:** Playwright can't load Firefox extensions headlessly, so Firefox is CI build + lint
  only, plus a manual smoke checklist (to be written in this file at the build stage).
- **Real-page fixtures:** reduced snapshots of third-party pages are kept minimal, credited and
  removable on request; confirm this is acceptable before publishing the repo.
- **Optional plain-language line (F12):** post-MVP. Chrome's built-in AI API shape must be confirmed
  with Context7 when built. The BYO-key provider defaults to Claude (`claude-opus-5-5`) per studio
  rule; the SDK's browser opt-in option name must be confirmed at build time.
- **Command palette:** intentionally omitted (DESIGN.md Shortcut Map explains the deviation from
  bible §6.8).
- The empty `.impeccable/questions/` folder is a leftover from the aborted run (not tracked by git).
