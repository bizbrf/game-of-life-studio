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
- **Architecture**: no middle-layer module imports from `ui.js`. `applyRule`, `undo`, `redo`, `randomFill` return `{ success, message }` result objects; `app.js` surfaces toasts and calls `updateUI`. Keyboard dispatch (`handleKeydown`) moved from `input.js` to `app.js`. `ADR-0003` retires the "one known exception" language.

### Fixed
- Batch 2 review (bugs): pinch-zoom TypeError on geometry tools, sparkline fill-polygon geometry, sparkline canvas zero-size transform reset, freehand stroke produces one undo entry instead of one-per-cell.
- Batch 1 review (architecture): `state.js ↔ rules.js` circular import, four undocumented `ui.js` imports from `history`/`sim`/`tools`/`input`, and inaccurate `module-map.md` entries now reflect reality.

### Removed
- Ad-hoc iteration screenshots from `output/`; three canonical ones promoted to `docs/screenshots/`.

### Accessibility
- Batch 5: modal focus trap + return-to-trigger; inspector focus management; focus ring restored on `:focus-visible` (2px accent outline); `prefers-reduced-motion` support (CSS + JS particles); `aria-pressed` on behavior toggles; `status-rule` span → real `<button>` with `aria-haspopup="menu"` + `aria-expanded`; sparkline popover keyboard-accessible via `focusin`/`focusout` on `status-pop-token`; speed popover focuses first option on open and returns focus on Escape.

### Performance
- Batch 3a: cache background `LinearGradient` (was re-allocated every frame); memoize `generateCustomPalette` by accent; cache each particle's `fillStyle` string on theme switch; replace `Math.max(...values)` spread in the sparkline with a manual loop; gate `renderPatternCard` canvas redraw on `(patternIndex, themeId, accent)` change; drop `getComputedStyle` calls from `drawGrid` / `drawGhostPreview` in favor of direct theme reads.

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
