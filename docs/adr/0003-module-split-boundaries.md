# ADR-0003: Module split boundaries for the v2 refactor

**Status:** Accepted
**Date:** 2026-04-14

## Context

The v2 app started as a single ~1450-line `index.html` with embedded `<style>` and `<script>` blocks. That was a deliberate deliverable shape (see [ADR-0002](0002-no-build-no-framework.md)) and it worked for the initial build. It stopped working as the app grew — adding a feature required touching an increasingly large, undifferentiated file; AI agents (and humans) had trouble reasoning about which section owned what; edits in one concern regularly broke unrelated ones.

The refactor split the single file into 15 ES modules. The question this ADR records is **what boundaries** the split should use.

Options considered:

- **Feature-based split** (`patterns/`, `rules/`, `themes/`, `history/`). Pro: matches how users think. Con: features cross-cut simulation, render, and UI — each folder would need its own sim, render, and UI slice, duplicating concerns.
- **Layer-based split** (`sim/`, `render/`, `ui/`). Pro: clean separation of concerns. Con: too coarse — `ui/` would be a single monolithic file again.
- **Lifecycle-based split** — one file per unit of the runtime lifecycle: what state looks like, how it steps, how it renders, how input is handled, how UI is wired, how history works, how I/O works. This is the option chosen.

The 15 modules — `app`, `state`, `constants`, `utils`, `patterns`, `rules`, `themes`, `history`, `sim`, `tools`, `audio`, `render`, `io`, `input`, `ui` — emerged from reading the monolith and naming the distinct responsibilities already present.

## Decision

Split `game-of-life-v2/` into one stylesheet and 15 ES modules, boundaries drawn by **responsibility lifecycle** (state → step → render → input → UI), not by feature. Dependency direction flows from leaves (`utils`, `constants`) up through the middle layer (sim, render, history, etc.) to UI orchestration (`ui`, `app`). Per-folder `AGENTS.md` files enforce the boundaries.

## Consequences

- **Clear ownership.** Each module answers a single question. When a bug appears in simulation stepping, the answer lives in `sim.js`, not spread across the codebase.
- **Dependency direction is mostly clean.** Leaves are pure; middle layer imports from leaves; `ui.js` imports from everything; `app.js` imports from everything and owns no domain logic.
- **The middle layer never imports `ui.js`.** The original version of this ADR carved out `rules.js → ui.js` (for `showToast` on invalid rule input) as the "one known exception." A 2026-04-14 code review found the pattern had spread silently to four more modules (`history.js`, `sim.js`, `tools.js`, `input.js`) and that `state.js` and `rules.js` had accumulated a true circular import. Batch 1 of the review (this commit set) resolved all of it: middle-layer modules now return `{ success, message }` or `{ message }` result objects, and callers (`app.js` orchestrator, `ui.js` event handlers) surface toasts via `showToast` and project state via `updateUI`. `handleKeydown` moved from `input.js` to `app.js` so keyboard dispatch no longer pulls the middle layer toward UI. There is no longer a "known exception."
- **Risk of module proliferation.** 15 modules for an app this size is already on the high end. Adding a 16th should require a new responsibility, not "this file got long." `game-of-life-v2/scripts/AGENTS.md` encodes this.
- **More imports to manage.** Each module declares its dependencies explicitly. `app.js` has a very large import block. That is the price of explicitness; bundlers do not apply here (see ADR-0002).

## Rules that follow

- New code goes in the module that owns its responsibility. If no existing module fits, pause — a new module is either justified (new responsibility) or a signal that an existing boundary is wrong.
- Dependency direction: **do not import upward.** No middle-layer module (`sim`, `render`, `history`, `io`, `rules`, `themes`, `audio`, `tools`, `input`) imports from `ui.js`. When a middle-layer operation has a user-facing outcome, return a result object and let `app.js` / `ui.js` decide how to surface it.
- `state.js` is the single store. No parallel state anywhere else. `state.js` must not import from modules above it in the hierarchy (a state.js ↔ rules.js cycle was removed in Batch 1).
- When a new module is added, update [../../game-of-life-v2/scripts/AGENTS.md](../../game-of-life-v2/scripts/AGENTS.md), [../agents/module-map.md](../agents/module-map.md), and (if it introduces a new layer) [../../ARCHITECTURE.md](../../ARCHITECTURE.md).
