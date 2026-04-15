# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The narrative dev log lives in [docs/journal.md](docs/journal.md). This file records release-shaped changes only — one entry per tag.

## [Unreleased]

### Added
- Initial repository setup with LICENSE (MIT), README, CONTRIBUTING, and GitHub issue/PR templates.
- `AGENTS.md` framework: root contract plus per-folder rules for `scripts/` and `styles/`.
- `ARCHITECTURE.md` and `docs/agents/` (module map, change protocol, verification playbook).
- First three ADRs: sparse grid representation, no-build/no-framework stance, module split boundaries.
- Canonical screenshots in `docs/screenshots/`.
- Live demo via GitHub Pages.

### Changed
- `CLAUDE-HANDOFF.md` archived as `docs/handoffs/2026-04-14-initial-handoff.md`; durable rules folded into `AGENTS.md`.
- `progress.md` renamed to `docs/journal.md`.
- `IMPLEMENTATION-SPEC.md` moved to `docs/specs/2026-04-14-v2-implementation-spec.md`.

### Removed
- Ad-hoc iteration screenshots from `output/`; three canonical ones promoted to `docs/screenshots/`.

### Accessibility
- Batch 5: modal focus trap + return-to-trigger; inspector focus management; focus ring restored on `:focus-visible` (2px accent outline); `prefers-reduced-motion` support (CSS + JS particles); `aria-pressed` on behavior toggles; `status-rule` span → real `<button>` with `aria-haspopup="menu"` + `aria-expanded`; sparkline popover keyboard-accessible via `focusin`/`focusout` on `status-pop-token`; speed popover focuses first option on open and returns focus on Escape.

### Performance
- Batch 3a: cache background `LinearGradient` (was re-allocated every frame); memoize `generateCustomPalette` by accent; cache each particle's `fillStyle` string on theme switch; replace `Math.max(...values)` spread in the sparkline with a manual loop; gate `renderPatternCard` canvas redraw on `(patternIndex, themeId, accent)` change; drop `getComputedStyle` calls from `drawGrid` / `drawGhostPreview` in favor of direct theme reads.
- Batch 3b: `drawCells` and `drawGhostPreview` now bucket cells by (color, alpha) and emit one compound path + one fill per bucket — replacing ~11 per-cell canvas state ops with one `save`/`restore` amortized across the whole draw. At 1,000 visible cells this drops from ~660k canvas API calls/sec to a few hundred fills/sec.

### Architecture
- Batch 4: Middle-layer modules no longer touch `document`/`window`. `themes.js` DOM writes moved to `ui.applyThemeToDOM`; `sim.randomFill` takes visibleBounds as a parameter instead of importing from `render.js`; `render.ensureCanvasSize` takes DPR as a parameter. `ARCHITECTURE.md` invariant 3 carves out Web platform APIs (`AudioContext`) with no DOM equivalent as a permitted middle-layer exception.

### Accessibility (part 2)
- Batch 6: `<details>` / `<summary>` +/− disclosure icon moved into a dedicated `aria-hidden` span so older screen readers don't announce the glyph.

### Browser compatibility
- Batch 6: `@supports not (backdrop-filter)` fallback swaps glass panels to opaque `--bg-2` so Chrome < 76 / Firefox < 103 keep legibility without the blur. Removed dead `window.webkitAudioContext` fallback (Safari 14+ supports the unprefixed API).

<!--
Release entries go above this line. Template:

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->
