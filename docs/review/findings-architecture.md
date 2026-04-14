# Review findings: architecture + module boundaries

Date: 2026-04-14
Reviewer: feature-dev:code-reviewer

## Summary

The 15-module split is broadly sound, but the documented "one known wart" (`rules.js → ui.js`) is in fact four separate upward boundary violations — `history.js`, `sim.js`, `tools.js`, and `input.js` all import from `ui.js` without being documented as exceptions. A true circular dependency exists between `state.js` and `rules.js`. Two middle-layer modules (`themes.js`, `render.js`) directly touch `document`/`window` in violation of the DOM-access invariant. Rough count: 2 Critical, 4 High, 3 Medium, 2 Low.

---

## Findings

### Critical: `state.js` ↔ `rules.js` circular dependency

- **File(s):** `game-of-life-v2/scripts/state.js:5` and `game-of-life-v2/scripts/rules.js:4`
- **Rule or principle:** ARCHITECTURE.md §Invariants — dependency direction must be acyclic; `state.js` is documented as a node that sits *below* `rules.js` in the hierarchy (module-map.md row 4 vs row 5)
- **What:** `state.js` imports `compileRule` from `rules.js` to initialise `state.rules`; `rules.js` imports `state` and `els` from `state.js`. This is a true mutual import cycle.
- **Evidence:**
  - `state.js:5` — `import { compileRule } from "./rules.js";`
  - `rules.js:4` — `import { state, els } from "./state.js";`
- **Impact:** ES modules resolve cycles via live bindings, so the app currently runs. But the initialisation order is load-order-dependent. If a future change causes `rules.js` to execute code at module-evaluation time that reads `state`, it will see the not-yet-populated object. It also means neither module can be tested in isolation, and any refactor of `state.js` must simultaneously reason about `rules.js`.
- **Fix:** Remove `compileRule` from `state.js` initialisation. Initialise `state.rules` to `null` (or a safe default), then have `app.js` call `applyRule(state.rule)` at boot — which it already does at `app.js:413`.

---

### Critical: Three undocumented upward imports into `ui.js` from the middle layer

- **File(s):**
  - `game-of-life-v2/scripts/history.js:6`
  - `game-of-life-v2/scripts/sim.js:15`
  - `game-of-life-v2/scripts/tools.js:6`
- **Rule or principle:** `scripts/AGENTS.md` §Rules — "Do not import from `ui.js` in sim/render/history." ADR-0003 — "`rules.js → ui.js` is the one and only known exception." `change-protocol.md` §Prohibited patterns — "DOM access outside `app.js` / `ui.js`" (calling `showToast` reaches through `ui.js` into DOM)
- **What:** Three middle-layer modules import from `ui.js`, propagating the pattern that ADR-0003 explicitly says must not be propagated.
  - `history.js` imports `showToast` to announce "Nothing to undo/redo."
  - `sim.js` imports `showToast` to announce random-fill completion.
  - `tools.js` imports `updateUI` to trigger a full UI repaint after tool or pattern selection.
- **Evidence:**
  - `history.js:6` — `import { showToast } from "./ui.js";`
  - `sim.js:15` — `import { showToast } from "./ui.js";`
  - `tools.js:6` — `import { updateUI } from "./ui.js";`
- **Impact:** The documented wart is now four instances. Any future module touching `ui.js` can justify it by precedent. `tools.js → ui.js` is particularly corrosive because `render.js` imports from `tools.js` (`render.js:7`), creating the implicit chain `render.js → tools.js → ui.js`, meaning render is one hop from UI. The `updateUI` call in `setTool`/`selectPattern` also means changing the tool triggers a full DOM repaint even when called programmatically from non-UI contexts.
- **Fix:** For `showToast` callers: have these functions return a result/error string and let the caller (`app.js` or `ui.js`) decide how to surface it — the approach ADR-0003 already recommends for `rules.js`. For `tools.js → updateUI`: remove the call; require callers (`input.js`, `ui.js`, `app.js`) to call `updateUI()` themselves after `setTool`/`selectPattern`.

---

### High: `sim.js` imports `visibleWorldBounds` from `render.js`

- **File(s):** `game-of-life-v2/scripts/sim.js:14`
- **Rule or principle:** ARCHITECTURE.md §Invariants rule 3 — "Sim / render / history / io modules should not touch `document` or `window`." More directly, the layered hierarchy places `sim.js` and `render.js` at the same tier; `sim.js` calling into `render.js` couples the simulation step to canvas geometry.
- **What:** `sim.randomFill` calls `visibleWorldBounds()` from `render.js` to determine the fill region when wrap is off. This means `sim.js` cannot step without a valid canvas context in `canvasRefs`.
- **Evidence:** `sim.js:14` — `import { visibleWorldBounds } from "./render.js";` used at `sim.js:111`.
- **Impact:** The simulation layer now has a hidden dependency on canvas size. Running `sim.js` in a headless test or non-canvas context will fail when `randomFill` is called with `wrap = false`. It also creates a conceptual mismatch: `visibleWorldBounds` is a viewport/camera concern, not a simulation concern.
- **Fix:** Move `visibleWorldBounds` (or a pure equivalent that takes camera and canvas dimensions as parameters) to `utils.js` or `state.js` as a selector, so `sim.js` can compute bounds without importing render.

---

### High: `themes.js` directly accesses `document.documentElement`

- **File(s):** `game-of-life-v2/scripts/themes.js:39`, `themes.js:55`
- **Rule or principle:** ARCHITECTURE.md §Invariants rule 3 — "DOM access lives in `app.js` and `ui.js`." `change-protocol.md` §Prohibited patterns — "DOM access outside `app.js` / `ui.js`."
- **What:** `setTheme` writes 15 CSS custom properties directly onto `document.documentElement.style` and sets `document.documentElement.style.colorScheme`.
- **Evidence:**
  - `themes.js:39` — `const root = document.documentElement.style;`
  - `themes.js:55` — `document.documentElement.style.colorScheme = theme.mode;`
- **Impact:** `themes.js` is imported by `render.js`, `io.js`, and `ui.js`. Any of those modules calling `setTheme` (e.g. `io.importJson` → `setTheme`) silently reaches into the DOM from a module that is documented as DOM-free. Headless tests that import `themes.js` will fail unless `document` is mocked.
- **Fix:** Move the `document.documentElement.style` writes into `ui.js` (e.g. a `applyThemeToDOM` function). `themes.js:setTheme` should update `state.themeIndex` and palette only; the DOM projection belongs in `ui.js`.

---

### High: `render.js` directly accesses `document` and `window`

- **File(s):** `game-of-life-v2/scripts/render.js:10`, `render.js:97`, `render.js:163`
- **Rule or principle:** ARCHITECTURE.md §Invariants rule 3 — "Sim / render / history / io modules should not touch `document` or `window`."
- **What:** `render.js` reads `window.devicePixelRatio` and calls `getComputedStyle(document.documentElement)` in two drawing functions.
- **Evidence:**
  - `render.js:10` — `const dpr = window.devicePixelRatio || 1;`
  - `render.js:97` — `ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim();`
  - `render.js:163` — `const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();`
- **Impact:** The `getComputedStyle` calls pull CSS variable values from the live DOM at every frame, which couples the render path to the document. This blocks headless canvas testing and contradicts the documented invariant. `window.devicePixelRatio` is less severe (it's a platform property, not a DOM tree query) but still technically violates the rule.
- **Fix:** Pass DPR into `ensureCanvasSize` as a parameter (or read it in `app.js` and store it). For the CSS variable reads in `drawGrid`/`drawGhostPreview`: store the resolved color values in `state` when `setTheme` runs (e.g. `state.resolvedColors.gridLine`, `state.resolvedColors.accent`) and read from state in `render.js`.

---

### Medium: `input.js` imports `cycleTheme` and `updateUI` from `ui.js`

- **File(s):** `game-of-life-v2/scripts/input.js:10–20`
- **Rule or principle:** Same dependency-direction rule as the Critical finding above; `input.js` sits in the middle layer, below `ui.js`.
- **What:** `input.js` imports `updateUI`, `openModal`, `closeModal`, `closeTopModal`, `isModalOpen`, `adjustSpeed`, `cycleTheme`, `toggleInspector`, and `closeInspector` from `ui.js`. Of these, the modal-query functions (`isModalOpen`, `closeTopModal`) are pure state queries that arguably belong in `state.js`; the rest are UI-mutation functions.
- **Evidence:** `input.js:10–20` — `import { updateUI, openModal, closeModal, closeTopModal, isModalOpen, adjustSpeed, cycleTheme, toggleInspector, closeInspector } from "./ui.js";`
- **Impact:** `input.js` cannot be loaded without loading `ui.js` and all of `ui.js`'s transitive imports (`render.js`, `themes.js`, `tools.js`, `audio.js`, `rules.js`). This is most of the app. Additionally `cycleTheme` is a UI composite operation (calls `setTheme` + `showToast` + `updateUI`) — having keyboard-handler logic embed it tightly couples theme cycling to `input.js`.
- **Fix:** Move `isModalOpen` / `closeTopModal` state queries to `state.js`. Have `handleKeydown` call `app.js`-level callbacks or dispatch events rather than calling `ui.js` functions directly.

---

### Medium: `audio.js` accesses `window.AudioContext`

- **File(s):** `game-of-life-v2/scripts/audio.js:6`
- **Rule or principle:** ARCHITECTURE.md §Invariants rule 3 — "Sim / render / history / io modules should not touch `document` or `window`." `audio.js` is in the middle layer alongside `sim.js` and `render.js`.
- **What:** `getAudioContext` reads `window.AudioContext` and `window.webkitAudioContext` directly.
- **Evidence:** `audio.js:6` — `const Ctor = window.AudioContext || window.webkitAudioContext;`
- **Impact:** Lower severity than the `themes.js`/`render.js` violations because the Web Audio API is genuinely a platform-level API without a DOM-equivalent. However, the rule is stated categorically. Inconsistency: `themes.js` (same tier) is called a violation while `audio.js` might be intentionally exempt. The rule as written doesn't carve out an exception for Web APIs.
- **Fix:** Either amend ARCHITECTURE.md to carve out "Web platform APIs (`AudioContext`, `devicePixelRatio`) that have no DOM equivalent are permitted in the middle layer", or wrap `getAudioContext` in a thin adapter in `app.js` and inject the constructor.

---

### Medium: `tools.js:dedupeCells` hand-assembles a cell key

- **File(s):** `game-of-life-v2/scripts/tools.js:32`
- **Rule or principle:** ARCHITECTURE.md §Invariants rule 5 — "Always use `keyFromXY(x, y)` / `xyFromKey(key)`. Do not hand-assemble the `'x,y'` string." ADR-0001 §Rules that follow — same requirement.
- **What:** `dedupeCells` builds a deduplication set using a hand-assembled `${x},${y}` string instead of `keyFromXY`.
- **Evidence:** `tools.js:32` — ``const key = `${x},${y}`;``
- **Impact:** If the canonical key format ever changes (e.g. switching to integer packing as ADR-0001 mentions as a future option), this line would be missed by a grep for `keyFromXY` and would silently produce incorrect deduplication.
- **Fix:** `import { keyFromXY } from "./utils.js"` (already imported in the same file via `mod`) and replace ``` `${x},${y}` ``` with `keyFromXY(x, y)`.

---

### Low: `cycleTheme` exported from `ui.js` but absent from `module-map.md`

- **File(s):** `game-of-life-v2/scripts/ui.js:354`, `docs/agents/module-map.md` §`ui.js` public surface
- **Rule or principle:** `change-protocol.md` §Adding a new export — "Add it to module-map.md's Public surface per module section."
- **What:** `cycleTheme` is a named export of `ui.js` consumed by `input.js`, but it does not appear in the public surface list for `ui.js` in `module-map.md`.
- **Evidence:** `ui.js:354` — `export function cycleTheme()`. `module-map.md` ui.js row does not list `cycleTheme`.
- **Impact:** Agents grepping module-map.md to find what `ui.js` exports will miss this function, increasing the risk of duplication.
- **Fix:** Add `cycleTheme` to the `ui.js` public surface row in `module-map.md`.

---

### Low: `module-map.md` lists `input.js` imports as `constants, state, utils` only

- **File(s):** `docs/agents/module-map.md` row 13
- **Rule or principle:** module-map.md §Module summary — the "Imports from scripts/" column is used by agents to reason about reverse dependencies.
- **What:** Row 13 for `input.js` lists `constants, state, utils` but the actual imports are `constants, state, utils, tools, sim, render, history, ui, audio` — nine modules, not three.
- **Evidence:** `input.js:3–21` (full import block).
- **Impact:** An agent checking reverse dependencies of, say, `render.js` via module-map.md would not know that `input.js` depends on it, potentially editing `render.js` exports without updating `input.js`.
- **Fix:** Update the `input.js` row in module-map.md to list all actual imports.

---

## Documentation accuracy

- `ARCHITECTURE.md §Known warts` says "`rules.js` imports `showToast` from `ui.js`" is the one violation; code also has `history.js:6`, `sim.js:15`, and `tools.js:6` doing the same.
- `ARCHITECTURE.md §Known warts` says "`state.js` mixes app-wide simulation state with DOM-ref caches" — this is accurate, but the more immediate structural problem (`state.js` importing `compileRule` from `rules.js`, creating a cycle) is not mentioned at all.
- `docs/agents/module-map.md` row 5 (`rules.js`) lists imports as `constants, state, ui*`; row 13 (`input.js`) lists `constants, state, utils` — the `input.js` column omits `tools`, `sim`, `render`, `history`, `ui`, and `audio`.
- `docs/agents/module-map.md` §`ui.js` public surface omits `cycleTheme` (exported at `ui.js:354`, imported by `input.js:17`).
- `ARCHITECTURE.md §Invariants rule 3` says "Sim / render / history / io modules should not touch `document` or `window`"; `themes.js` and `audio.js` are not named in that list but also violate the spirit of the rule.
- `scripts/AGENTS.md §Dependency direction` diagram shows `state.js` in the second layer below utils/constants and above the middle tier; the actual code has `state.js` importing `rules.js` (middle tier), inverting the stated direction.

---

## Not a concern (noted but dismissed)

- `input.js` dynamic `import("./tools.js")` at `input.js:176` for the Tab key `selectPattern` call — the comment correctly identifies this as a load-order workaround. There is no actual cycle: `tools.js` does not import `input.js`. The lazy import prevents a startup circular-reference between two modules that call each other at runtime only. Intentional and acceptable.
- `ui.js` importing from `render.js` (`drawSparkline`, `drawPatternPreview`) — `ui.js` is the top of the middle layer and importing render helpers into UI is the expected direction per the hierarchy.
- `ui.js` importing from `rules.js` (`getRuleLabel`) — this is the correct direction (UI importing from middle layer) and is not a violation.
- `app.js` setting `document.documentElement.style` directly at `app.js:281–282` (accent picker handler) — `app.js` is an explicitly permitted DOM-access module.
- `render.js` importing from `tools.js` — same layer, both are in the middle tier; the ghost-preview rendering legitimately needs tool geometry. Not a boundary violation per the documented hierarchy.
- `ui.js` re-exporting `hexToRgb` from `utils.js` at `ui.js:350` — convenience re-export used by `app.js`. Slightly unusual but not a boundary violation; `app.js` could import directly from `utils.js` instead, but this is cosmetic.
- `state.js:buildParticles` using `Math.random` — this initialises static particle positions at module evaluation time, not in the simulation step path. Does not violate the determinism invariant.
