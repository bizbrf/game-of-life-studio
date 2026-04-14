# Review findings: performance

Date: 2026-04-14
Reviewer: feature-dev:code-reviewer

## Summary

The rendering path is the dominant performance problem. Every frame, each live cell triggers a full canvas `save`/`restore` cycle inside `drawRoundedRect`, and every frame a new `LinearGradient` object is allocated for the background. The RAF loop also unconditionally calls `updateUI` which redraws the pattern preview canvas every single frame. These three issues alone cause O(population) canvas-state thrashing plus O(1) expensive allocations at 60fps regardless of whether anything changed. The simulation step path (`computeNeighborCountMap`, `stepSimulation`) has expected per-step allocation cost but no surprises beyond what ADR-0001 already accepts. 8 findings total: 2 Critical, 4 High, 2 Medium.

---

## Findings

### Critical — `save`/`restore` + full state write per cell in `drawRoundedRect`

- **File:** `game-of-life-v2/scripts/render.js:55-68` (called from lines 133 and 140)
- **Hot path?:** Yes — `drawCells()` is called every frame; `drawRoundedRect` is called once per visible live cell and once per visible fading cell.
- **What:** `drawRoundedRect` calls `ctx.save()`, sets `globalAlpha` and `fillStyle`, builds a full rounded-rect path (5 path commands), calls `ctx.fill()`, then `ctx.restore()` — individually per cell, with no batching by color or alpha.
- **Cost estimate:** At 1,000 live cells: 1,000 `save`, 1,000 `restore`, 1,000 `fillStyle` string assignments, 1,000 `globalAlpha` writes, 1,000 `beginPath`, 5,000 path commands, 1,000 `fill` calls. That is ~11,000 canvas API calls per frame just for cells, scaling linearly with population.
- **Evidence:**

  ```js
  // render.js:55-68
  export function drawRoundedRect(context, x, y, width, height, radius, fillStyle, alpha = 1) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = fillStyle;
    context.beginPath();
    // ... 5 path ops ...
    context.fill();
    context.restore();
  }
  // Called per cell:
  drawRoundedRect(ctx, point.x + 0.5, point.y + 0.5, size, size, radius, color, Math.min(1, 0.35 + age * 0.08));
  ```

- **Fix:** Batch cells by color bucket (palette index, not per-cell). Sort cells by `(paletteIndex, alphaLevel)`, open one `beginPath`, emit all cells sharing that color as sub-paths, call `fill` once per bucket. Eliminates `save`/`restore` entirely; reduces `fill` calls from N to ≤8 (palette size). Also drop `save`/`restore` in favor of explicit state restore for the two properties being changed.

---

### Critical — New `LinearGradient` allocated every frame for background

- **File:** `game-of-life-v2/scripts/render.js:73`
- **Hot path?:** Yes — `drawBackgroundAtmosphere()` is called unconditionally on every `draw()` call (line 198).
- **What:** `ctx.createLinearGradient(...)` constructs a new gradient object and `.addColorStop` is called twice on it every frame at 60fps, even though the background colors never change unless the theme changes.
- **Cost estimate:** 1 gradient allocation + 2 color-stop writes at 60fps = 3,600 objects/minute that are immediately GC'd after one fill.
- **Evidence:**

  ```js
  // render.js:73-77
  const gradient = ctx.createLinearGradient(0, 0, canvas.clientWidth, canvas.clientHeight);
  gradient.addColorStop(0, theme.colors.bg);
  gradient.addColorStop(1, theme.colors.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ```

- **Fix:** Cache the gradient in a module-level variable keyed by `(themeId, canvasWidth, canvasHeight)`. Recreate only when the theme changes or canvas is resized (both are already observable events: `setTheme` and `ensureCanvasSize`). Expected improvement: eliminate 60 gradient allocations per second.

---

### High — `updateUI()` called unconditionally every RAF frame, including `renderPatternCard()` → `drawPatternPreview()` canvas redraw

- **File:** `game-of-life-v2/scripts/app.js:405` and `game-of-life-v2/scripts/ui.js:328`
- **Hot path?:** Yes — runs every frame at up to 60fps regardless of whether state changed.
- **What:** `updateUI` does substantial work each frame: 4 `.toLocaleString()` calls (allocates strings), iterates all tool/toggle/theme DOM children with `classList.toggle`, calls `renderPatternCard()` at line 328 which calls `drawPatternPreview()` — a full canvas render of the pattern preview card — every frame.
- **Cost estimate:** `drawPatternPreview` iterates all cells of the current pattern and calls `drawRoundedRect` per cell; for the Gosper Gun pattern that is 36 `drawRoundedRect` calls (×11 canvas ops each) at 60fps on a secondary canvas. `toLocaleString` on generation counter allocates a new formatted string every frame.
- **Evidence:**

  ```js
  // app.js:404-406
  draw();
  updateUI();   // called every frame
  requestAnimationFrame(updateLoop);

  // ui.js:328
  renderPatternCard();  // inside updateUI, called every frame

  // ui.js:115-119
  export function renderPatternCard() {
    ...
    if (els.patternCardPreview) drawPatternPreview(els.patternCardPreview, pattern, getTheme().colors.accent);
  }
  ```

- **Fix:** Add a dirty-flag or compare previous state before updating DOM. At minimum, guard `renderPatternCard()` behind a check of `state.patternIndex` and theme — only redraw when either changes. A lightweight approach: cache `lastPatternIndex` and `lastThemeId` as module-level vars in `ui.js`; skip `renderPatternCard` if neither changed. For the broader `updateUI`, consider only running the full pass when `state.generation` changed or a user action occurred, using a `uiDirty` flag set by any state-mutating action.

---

### High — `getComputedStyle` forced style recalculation inside `drawGrid` and `drawGhostPreview`

- **File:** `game-of-life-v2/scripts/render.js:97` and `render.js:163`
- **Hot path?:** Yes — `drawGrid` runs every frame when `state.gridLines` is true (line 199); `drawGhostPreview` runs every frame (line 202).
- **What:** `getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim()` inside `drawGrid` forces the browser to flush pending style recalculations and read a computed value mid-frame. Same pattern in `drawGhostPreview` for `--accent`.
- **Cost estimate:** Two forced style reads per frame when grid is on; one per frame always for ghost preview (when `previewCells.length > 0`). `getComputedStyle` can force a synchronous layout recalc; even if the browser caches it within a frame it adds cross-thread overhead.
- **Evidence:**

  ```js
  // render.js:97
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim();

  // render.js:163
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  ```

- **Fix:** Cache these values in module-level variables that are updated only inside `setTheme()` (which already writes these exact CSS properties, lines 52 and 49 of `themes.js`). `setTheme` is the only place these values change; reading from a cache string is O(1) with zero style-system involvement.

---

### High — `sparkline.drawSparkline` uses spread to find max over up to 200 values

- **File:** `game-of-life-v2/scripts/render.js:177`
- **Hot path?:** `drawSparkline` is called from `showSparklinePopover` (on hover, not every frame) and also whenever `updateUI` is triggered while the sparkline popover is visible. Not a per-frame cost by default, but called on every step when running with the popover open.
- **What:** `Math.max(...values)` spreads an array of up to 200 numbers as function arguments. This allocates the spread, bypasses the fast-path for `Math.max`, and on V8 can be meaningfully slower than a manual loop for large arrays.
- **Cost estimate:** 200-element spread + argument spread allocation on every sparkline draw.
- **Evidence:**

  ```js
  // render.js:177
  const max = Math.max(...values, 1);
  ```

- **Fix:** Replace with `let max = 1; for (const v of values) if (v > max) max = v;` — no allocation, no argument spread overhead.

---

### High — `computeNeighborCountMap` allocates a new `Map` and N×9 key strings every step

- **File:** `game-of-life-v2/scripts/sim.js:27-43`
- **Hot path?:** Yes — called once per `stepSimulation` which can fire multiple times per frame at max speed.
- **What:** Every call allocates `new Map()` plus calls `keyFromXY` (which allocates a template-literal string) for each of the 8 neighbors of every live cell. At N live cells, this is `N×8` string allocations per step for neighbor keys plus `N` string allocations for the center cell key read in the second loop.
- **Cost estimate:** At 500 live cells and 60 steps/s (turbo): 500×9×60 = 270,000 string allocations/second plus 60 `new Map` allocations. ADR-0001 explicitly accepts this cost at current scale and identifies integer key encoding as the forward path.
- **Evidence:**

  ```js
  // sim.js:28-43
  const counts = new Map();
  for (const key of state.liveCells.keys()) {
    const [x, y] = xyFromKey(key);          // string parse
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nKey = keyFromXY(nx, ny);      // string alloc per neighbor
        counts.set(nKey, (counts.get(nKey) || 0) + 1);
      }
    }
  }
  ```

- **Fix:** Per ADR-0001: if profiling confirms this is the bottleneck at higher populations, migrate to a packed integer key (`x * LARGE_PRIME + y` or bit-packing into a 64-bit BigInt / two 32-bit numbers). This is a breaking change to the key format; coordinate with invariant #5 in ARCHITECTURE.md. At current typical populations (hundreds of cells) this is below the visible threshold — ADR-0001 explicitly defers this.

---

### Medium — `getPaletteColors()` calls `generateCustomPalette()` every frame when using custom accent

- **File:** `game-of-life-v2/scripts/themes.js:28-31` (called from `render.js:123` inside `drawCells`)
- **Hot path?:** Yes — `drawCells` calls `getPaletteColors()` every frame; if `state.paletteId === "custom"` the full palette is regenerated.
- **What:** `generateCustomPalette` allocates an 8-element array, calls `hexToRgb` once, and runs 8 iterations each calling `mixColor` (3 `Math.round` calls) and `rgbToHex` (array allocation + `.map` + `.join`). Triggered every frame while a custom palette is active.
- **Cost estimate:** 8 `mixColor` calls + 8 `rgbToHex` calls (each creating a 3-element array + map result) = ~24 short-lived allocations per frame at 60fps = 1,440 allocations/second.
- **Evidence:**

  ```js
  // themes.js:28-31
  export function getPaletteColors() {
    return state.paletteId === "custom"
      ? generateCustomPalette(state.accent)   // always recomputes
      : PALETTES[state.paletteId].colors;
  }
  ```

- **Fix:** Memoize: store `{ accentHex, colors }` in a module-level cache variable inside `themes.js`. Return the cached array if `state.accent === cache.accentHex`. The accent only changes on user interaction (`accentPicker` input event), not per frame. One `===` comparison per frame instead of 24+ allocations.

---

### Medium — `drawParticles` builds a new template string per particle per frame

- **File:** `game-of-life-v2/scripts/render.js:84-86`
- **Hot path?:** Yes — `drawParticles` is called every frame when `state.particles` is true (default on). 28 particles.
- **What:** For each of 28 particles, ``` `${accent}${particle.alpha})` ``` concatenates a string with a dynamic float value. Each template literal allocates a new string. `particle.alpha` is a float that changes every frame (particle positions update), so the string is always different and cannot be cached per particle.
- **Cost estimate:** 28 string allocations per frame at 60fps = 1,680 short-lived strings/second. Minor but avoidable.
- **Evidence:**

  ```js
  // render.js:83-86
  const accent = `rgba(${getTheme().colors.accentRgb},`;
  state.particlesState.forEach((particle) => {
    ctx.fillStyle = `${accent}${particle.alpha})`;
  ```

- **Fix:** The particle alpha values are fixed at init time (`Math.random() * 0.25 + 0.08`) and never change during particle movement — only x/y/etc change (see `updateParticles`, render.js:205-213). Pre-compute each particle's full `fillStyle` string once at build time (in `buildParticles` in `state.js`) and store it on the particle object. Then `ctx.fillStyle = particle.fillStyle` requires zero allocation per frame.

---

## Already efficient (noted)

- **`sim.js` step loop structure** — iterates `neighborCounts` once, then checks isolated live cells in a second pass; no redundant Map lookups beyond what the algorithm requires.
- **`updateFadeAnimations`** — mutates in-place and deletes completed entries; no allocation inside the loop body.
- **`history.pushSimulationSnapshot` / `captureSnapshot`** — full `cloneMapEntries` clone per step is expected cost for the rewind feature; depth is capped at `MAX_REWIND = 80`. The clone uses `Array.from` with a mapper, which is idiomatic.
- **`pushPopulation` `array.shift()`** — shifts a 200-element array per step. Technically O(N) but at N=200 this is ~200 element moves; not measurable. A ring-buffer would be cleaner but this is not a hot cost.
- **`drawGrid` batching** — grid lines are correctly batched into a single path + single `stroke()` call. No per-line path.
- **`patterns.js` size** — 13 patterns, all small; `parsePattern` runs at load time, not per frame. No base64 or large embedded data.
- **15 ES module HTTP requests** — each file is small (< 5KB); total payload is negligible. No large data files.
- **`input.js` pointermove** — calls `updateInteraction` which does `screenToWorld` (cheap math) and optionally `addCells` for freehand, which is user-gated. No per-event DOM read or layout trigger.
- **`renderPatternBrowser`** — full DOM rebuild only fires on user input events (`patternSearch` input, `patternCategory` change), not in the RAF loop. Acceptable cost for a modal interaction.
- **`state.particlesState`** — 28 particles, fixed array, mutated in place. `forEach` over 28 elements is not a hot cost.
- **`worldToScreen` object allocation** — allocates `{x, y}` per call. Called once per live cell per frame. At current population counts this is acceptable, but would become visible if cell counts reach tens of thousands.
- **`xyFromKey` string parsing** — uses `indexOf` + `slice` + `Number`, which is faster than `split`. Called N times per draw and N×9 per step; already close to optimal for string keys.
