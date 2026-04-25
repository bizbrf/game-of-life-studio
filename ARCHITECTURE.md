# Architecture

How the 15 modules fit together, how data flows, and what invariants you must not break.

Narrative. For a tabular quick-reference, see [docs/agents/module-map.md](docs/agents/module-map.md).

## High-level shape

A single-page canvas app. `index.html` loads one stylesheet and 15 ES modules. `app.js` is the entry point; everything else is imported on demand. There is no framework, no bundler, no server — the same files served by `python -m http.server` work unchanged on GitHub Pages.

```
index.html
  ↓ <link> main.css
  ↓ <script type="module"> app.js
       ├── hydrates DOM refs into state.els / state.canvasRefs
       ├── binds canvas, keyboard, and DOM events
       ├── initialises theme, rule, snapshot
       └── starts requestAnimationFrame loop
```

The RAF loop drives everything. Each frame: accumulate delta time, advance the sim if running, render the canvas, sync the UI.

## Data flow

### Simulation state

`state.liveCells: Map<string, number>` is the source of truth. The key is `"x,y"` (string); the value is the cell's age in generations.

Why a sparse map instead of a dense array: the grid is infinite. Most cells are empty. See [ADR-0001](docs/adr/0001-sparse-grid-map.md).

Each step:

```
sim.js → computeNeighborCountMap(state.liveCells)
       → apply rule → newLiveCells
       → state.liveCells = newLiveCells
       → state.generation++
       → history.pushSimulationSnapshot()
```

`state.fadingCells` tracks recently-dead cells for the death-fade animation. Rendered by `render.js`; updated by `sim.updateFadeAnimations(dt)`.

### History

Two separate stacks, different purposes:

- `state.undoStack` / `state.redoStack` — user edits (paint, erase, clear, pattern stamp). Coarse diffs, labelled. Depth capped at `MAX_UNDO`.
- `state.simulationHistory` — generation snapshots for the rewind slider. Captures full cell state every N generations. Depth capped at `MAX_REWIND`.

Rewind and undo coexist intentionally. Undo rewinds the last *edit*; the rewind slider rewinds the last N *generations*.

### Rendering

`render.js` draws directly to a single 2D canvas. The camera lives in `state.camera` (`x`, `y`, `zoom`). Coordinate helpers:

- `worldToScreen(x, y)` — sim-space → pixel-space
- `screenToWorld(clientX, clientY)` — inverse
- `visibleWorldBounds(padding)` — the clipping rect for cell iteration

Rendering is frame-rate-independent. The simulation step is driven by an accumulator (`state.accumulator`) that consumes `state.speed` generations per second of wall time.

### Input

`input.js` owns the interaction state machine (`state.interaction`). Transitions:

```
idle
  ↓ beginInteraction(kind, x, y, button)
active interaction ("paint" | "erase" | "pan" | "tool-line" | "tool-box" | "tool-circle" | "touch-panzoom")
  ↓ updateInteraction(x, y)     (per pointermove)
  ↓ endInteraction()            (on pointerup / cancel)
idle
```

`app.js` binds the raw DOM events, runs the keyboard-shortcut dispatch (`handleKeydown`), and calls into `input.js` for pointer / touch translation and camera math. Keeping keyboard dispatch in `app.js` is what lets `input.js` stay free of upward imports into `ui.js`, `audio.js`, and `history.js`.

## Invariants — do not break

1. **`state.js` is the only store.** Do not allocate parallel state objects elsewhere. The RAF loop assumes one shared mutable object graph.
2. **`utils.js` has no imports from other `scripts/` files.** It is the leaf of the dependency graph. Keep it pure.
3. **DOM access lives in `app.js` and `ui.js`.** Sim / render / history / io modules should not touch `document` or `window`.
4. **Simulation is deterministic given `(rule, liveCells)`.** No `Math.random` in the step path. Random fill lives in `sim.randomFill` and is a one-shot user action.
5. **Sparse map keys are canonical.** Always use `keyFromXY(x, y)` / `xyFromKey(key)`. Do not hand-assemble the `"x,y"` string.
6. **Wrap mode is an input-time transformation.** `sim.normalizeWrappedCoord` canonicalises coordinates when wrap is on. If wrap is off, no coordinate clamping happens anywhere; the grid is genuinely infinite.

## Known warts

- **`state.js` mixes app-wide simulation state with DOM-ref caches (`els`, `canvasRefs`).** Functional, but the shape signals two different concerns. Splitting is a cycle-D candidate.

Historical: `rules.js → ui.js` (showToast) was documented here as the one known exception. It was resolved in Batch 1 — middle-layer modules now return result objects and callers in `app.js` / `ui.js` surface toasts and call `updateUI`. See [ADR-0003](docs/adr/0003-module-split-boundaries.md).
Historical: `themes.js` / `render.js` DOM and CSS round-trips, `sim.js → render.js` for viewport bounds, and `audio.js → window.AudioContext` were resolved during the Cycle D cleanup. Theme DOM projection now lives in `ui.applyThemeToDOM()`, `randomFill` receives viewport bounds from callers, and `app.js` injects the browser audio constructor into `audio.js`.

## Cross-cutting concerns

### Themes

`themes.js` is state-only: it selects the active theme, palette, and accent. `ui.applyThemeToDOM()` projects that state to `<html>` attributes and CSS custom properties consumed by `main.css`. This keeps simulation and rendering logic theme-oblivious while preserving one DOM projection point.

### Persistence

None. No localStorage, no cookies. The app boots fresh each load. RLE / JSON import-export in `io.js` is the supported way to persist a pattern.

### Test hooks

`app.js` exposes:

- `window.render_game_to_text()` — JSON snapshot of visible state for headless smoke tests.
- `window.advanceTime(ms)` — advance the sim loop manually for deterministic Playwright runs.
- `window.__gameOfLifeV2 = { state, exportToJson, exportToRle }` — escape hatch for integration tests.

These are the only reasons the app exposes globals. Do not add more without a journal entry explaining why.
