# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - unreleased

First public version.

### Added

- Marker scanner for `*`, `†`, `‡`, `§`, `¶`, `<sup>` digits, Unicode superscripts and "Terms
  apply"-style phrases, skipping cents superscripts, ordinals, trademarks, math, code, bullets and
  ratings. Runs in 8 ms slices; very large pages scan only main, footer and legal containers.
- Two-stage matcher (linked footnotes, then legal containers, small type and closed accordions) with
  a confidence per match, a "No footnote found" state and "Terms are on another page" links.
- Many-to-one handling: the sentence with the most word overlap is chosen, the full text sits behind
  an expander.
- Deterministic chip extractor for carrier, bank, retail, streaming, SaaS and travel pages: money,
  time, rate, requirement, exclusion and renewal chips.
- In-page card with the footnote flight, ghost outline and bezier tether; reduced-motion variant.
- Show all (`Alt+Shift+C`) with fanned tethers, a rail (bottom sheet on narrow windows) and
  `J`/`K`/`Enter`/`Esc`/`?` keys.
- Share this catch: a 1200 x 630 PNG drawn locally.
- Toolbar badge and popup ledger with per-site on/off and eight designed states.
- Options page and a welcome page with a labeled specimen.
- Landing page and an installable offline web app (`site/`) that run the same engine on pasted text
  or HTML.
- `pnpm engine <page.html>` prints the engine's findings for a saved page as JSON.
- Bundle-size ceilings (`pnpm check:size`) and a no-network build check (`pnpm check:network`).

### Not in this version

- Accuracy on real pages is not measured on a public corpus.
- Firefox is built and linted but not runtime-tested.
- The optional on-device plain-language line is a saved setting only.

[0.1.0]: https://github.com/NINJA981/catchline/releases/tag/v0.1.0
