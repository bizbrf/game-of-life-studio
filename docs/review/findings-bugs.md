# Review findings: bugs and logic errors

Date: 2026-04-14
Reviewer: feature-dev:code-reviewer

## Summary

The codebase is generally solid — the simulation core, history, and coordinate math are all correct. Two real bugs were found: one crash in the touch interaction path and one silent rendering corruption in the sparkline. Three medium/low issues cover an unguarded zero-size canvas, inconsistent undo history growth during freehand strokes, and a minor import-direction divergence in `sim.js` and `history.js` that doesn't yet cause a bug but extends the known wart beyond its documented scope.

---

## Findings

### High — `endInteraction` crashes with TypeError when a pinch-zoom ends while a geometry tool is active

- **File:** `game-of-life-v2/scripts/input.js:83–88`
- **What:** Calling `endInteraction()` after a two-finger pinch-zoom gesture, with the current tool set to `line`, `box`, or `circle`, throws `TypeError: Cannot read properties of undefined (reading 'x')`.
- **Why it's wrong:** `touch-panzoom` interaction objects are created in `app.js:142–152` with no `start` or `current` field. `endInteraction` guards for `"pan"` at line 82 and returns early, but has no equivalent guard for `"touch-panzoom"`. The check `["line", "box", "circle"].includes(state.currentTool)` at line 83 passes whenever those tools are active, then `getToolCells(interaction.start, interaction.current || interaction.start)` is called with both arguments `undefined`. `buildLineCells`/`buildBoxCells`/`buildCircleCells` all immediately dereference `.x` on their first argument.
- **Evidence:**
  - `app.js:143`: `state.interaction = { type: "touch-panzoom", startCameraX, ..., startDistance }` — no `start` field.
  - `app.js:174`: `if (event.touches.length === 0) endInteraction();` — fires when all fingers lift.
  - `input.js:85`: `getToolCells(interaction.start, interaction.current || interaction.start)` — both `undefined` when panzoom.
  - `tools.js:41`: `let x0 = start.x;` — crashes.
  - `render.js:149` shows the pattern that is missing here: it checks `state.interaction.start` before calling `getToolCells`.
- **Fix:** Add `if (interaction.type === "touch-panzoom") return;` immediately after the `"pan"` guard at `input.js:82`.

---

### High — `drawSparkline` fill area is drawn against an already-stroked path, producing a geometrically-wrong fill polygon

- **File:** `game-of-life-v2/scripts/render.js:187–192`
- **What:** The fill-under-curve polygon does not call `beginPath()` before adding its closing points, so it inherits the already-stroked data path. The `fill()` call then closes from `(0, height)` back to the `moveTo` at `(x0, y0)`, not to `(0, firstDataY)` — producing a diagonal instead of a vertical left edge when the first data point is not at `y = height`.
- **Why it's wrong:** Standard practice for separate stroke + fill passes is to call `beginPath()` before each, or do a single pass with both `stroke()` and `fill()` on the same closed path. Current code conflates two passes without resetting the path.
- **Evidence:** `render.js:180` — `sparkCtx.beginPath()` opens a path. `render.js:187` — `sparkCtx.stroke()` strokes it but leaves it open. `render.js:188–192` — fill style is changed and the path is extended and filled without a new `beginPath()`.
- **Fix:** After `sparkCtx.stroke()` at line 187, call `sparkCtx.beginPath()`, then `moveTo(0, height)`, walk the polygon with `lineTo`, then `closePath()` and `fill()`.

---

### Medium — `ensureCanvasSize` sets sparkline canvas dimensions to zero without a minimum-1 guard

- **File:** `game-of-life-v2/scripts/render.js:16–18`
- **What:** Sparkline canvas `width`/`height` set to `Math.floor(clientWidth * dpr)` with no `Math.max(1, ...)` guard, unlike the main canvas (line 13–14). A zero-dimension canvas resets its 2D context, clearing the transform set by `setTransform` at line 18 — so the sparkline draws at wrong scale until the next resize produces non-zero dimension.
- **Why it's wrong:** When the sparkline popover is hidden, `clientWidth`/`clientHeight` are 0. After `ensureCanvasSize()` runs on window resize, canvas is zeroed and DPR transform is reset. Next `drawSparkline` call draws without transform, producing unscaled output on HiDPI displays.
- **Evidence:** `render.js:16`: `sparklineCanvas.width = Math.floor(sparklineCanvas.clientWidth * dpr)` — no floor guard. Compare `render.js:13`: `canvas.width = Math.max(1, Math.floor(clientWidth * dpr))`.
- **Fix:** Apply the same `Math.max(1, ...)` guard to lines 16 and 17.

---

### Medium — Freehand stroke generates one undo entry per pointer-move event

- **File:** `game-of-life-v2/scripts/input.js:67–73`, `game-of-life-v2/scripts/sim.js:129–143`
- **What:** Each call to `updateInteraction` during a freehand stroke calls `addCells([[world.x, world.y]], ...)`, which calls `commitDiffFromMaps` → `pushUndoEntry`, pushing a new entry onto `undoStack`. A fast stroke across 150 cells creates 150 undo entries; `MAX_UNDO = 120` causes the oldest 30 to be silently shifted off.
- **Why it's wrong:** The user expects to undo an entire stroke in one Ctrl+Z step. Instead each step-back undoes one cell, and long strokes silently discard earlier edits that the user may want to recover.
- **Evidence:** `input.js:68–73` — `addCells` is called with a single-cell array inside `pointermove`. `sim.js:137` — `commitDiffFromMaps(before, state.liveCells, label)` is called unconditionally. `constants.js:5` — `MAX_UNDO = 120`.
- **Fix:** Batch all cells painted in a single freehand stroke into one undo entry. Accumulate cells in `state.interaction` during the stroke; commit the diff against the pre-stroke state only in `endInteraction()`.

---

### Medium — `sim.js`, `history.js`, `tools.js`, and `input.js` all import from `ui.js`, extending the documented "one known wart" to five instances

- **File:** `game-of-life-v2/scripts/sim.js:15`, `history.js:6`, `tools.js:6`, `input.js:20`
- **What:** ADR-0003 and `ARCHITECTURE.md` document `rules.js → ui.js` as the _one and only known exception_ to the dependency direction rule. In reality there are five such imports. The module map (`docs/agents/module-map.md`) lists none of them.
- **Why it's wrong:** This is not yet a functional bug — ES module circular references are handled by live bindings and all callsites are inside functions. However the module map is factually wrong, and the undocumented violations mean future agents will be misled about the dependency graph.
- **Evidence:** `grep 'from "./ui.js"'` in `scripts/` returns `history.js:6`, `sim.js:15`, `rules.js:5`, `tools.js:6`, `input.js:20`, `app.js:41` — 4 undocumented violations beyond the 1 in the ADR.
- **Fix:** Either (a) move toast/UI calls to the calling layer (`app.js`/`ui.js`) and have middle-layer modules return error strings or throw, or (b) update the module map and architecture docs to accurately reflect the actual dependency graph and amend ADR-0003. **Note:** This finding overlaps with the Architecture review — to be consolidated in REVIEW.md.

---

## Not-a-bug (noted but dismissed)

- **`historyCursor: 0` with empty `simulationHistory` at module load** — the cursor points into empty history between module eval and `initialize()`, but no code runs in that window (ES modules are deferred until DOMContentLoaded), and `pushSimulationSnapshot()` corrects the invariant on first call.
- **`parseRLE` rule regex rejects non-B/S notations** — intentional; app only supports B/S cellular automata.
- **`updateFadeAnimations` deletes from Map during iteration** — safe per ECMAScript spec.
- **`resetSimulation` undo diff after `state.liveCells.clear()`** — diff is built before `clear()`; the diff holds value snapshots (integers), not references.
- **Circular ES module imports** — handled correctly by live binding; all cross-module calls are at function call time, not module evaluation time.
- **`applyRule` called early in `initialize()`** — `hydrateDomReferences()` runs first; all required `els` are populated before `applyRule` is reached.
