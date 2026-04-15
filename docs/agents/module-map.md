# Module map

Tabular reference for the `game-of-life-v2/scripts/` folder. When a signature or dependency shifts, update this file in the same commit.

For narrative context see [../../ARCHITECTURE.md](../../ARCHITECTURE.md).

## Module summary

**This map describes the state after all 6 review-cycle PRs merge to `main` in recommended order (#12 Batch 1 → #13 Batch 5 → #14 Batch 3a → #15 Batch 3b → #16 Batch 4 → #17 Batch 6).** Batch 6 itself is stacked behind Batch 4 but was committed on top of a branch that has not yet seen Batch 1's handleKeydown move or Batch 1's import-table corrections. If Batch 6 lands before Batch 1, re-sync this file against the actual `input.js` / `rules.js` / `sim.js` / `tools.js` / `history.js` import blocks — the recommended merge order avoids that.

All upward imports from the middle layer to `ui.js` are documented-gone; see [docs/review/REVIEW.md](../review/REVIEW.md) for the batch breakdown.

| # | File | Responsibility | Imports from scripts/ |
|---|---|---|---|
| 1 | `constants.js` | Tunables and tables. Leaf. | — |
| 2 | `utils.js` | Pure helpers. Leaf. | — |
| 3 | `patterns.js` | Pattern data + `parsePattern`. Leaf. | — |
| 4 | `state.js` | Shared mutable store. | `constants` |
| 5 | `rules.js` | B/S rule parse, compile, apply. | `constants`, `state` |
| 6 | `themes.js` | Theme + palette state (DOM projection lives in `ui.applyThemeToDOM`). | `constants`, `state`, `utils` |
| 7 | `history.js` | Undo/redo + rewind snapshots. | `constants`, `state`, `utils` |
| 8 | `sim.js` | Simulation step, reset, random fill. | `constants`, `state`, `utils`, `history`, `audio` |
| 9 | `tools.js` | Drawing tool geometry + selection. | `patterns`, `state`, `utils` |
| 10 | `audio.js` | Ambient hum + step sound. Uses `window.AudioContext` per the Web-platform-API carve-out in ARCHITECTURE invariant 3. | `state` |
| 11 | `render.js` | Canvas draw, coords, particles, sparkline, pattern preview. | `constants`, `state`, `utils`, `themes`, `tools` |
| 12 | `io.js` | RLE + JSON import/export. | `state`, `utils`, `rules`, `themes`, `history`, `sim` |
| 13 | `input.js` | Pointer/touch interaction, zoom, autoFit. | `constants`, `state`, `utils`, `tools`, `sim`, `render` |
| 14 | `ui.js` | DOM wiring — toolbar, inspector, modals, popovers, theme projection. | `constants`, `patterns`, `state`, `utils`, `themes`, `rules`, `tools`, `audio`, `render` |
| 15 | `app.js` | Entry point, event binding, RAF loop, keyboard shortcuts. | everything |

Notes:
- **No middle-layer module imports from `ui.js`.** Closed in Batch 1 of the review.
- **No middle-layer module touches `document` or `window`** except `audio.js` (Web-platform-API carve-out for `AudioContext`). Closed in Batch 4.
- **Keyboard dispatch (`handleKeydown`) lives in `app.js`**, not `input.js`. This lets `input.js` stay free of upward imports.

## Public surface per module

Minimal list to help agents pick the right module without reading every file. When an exported name changes, update the matching row.

### `constants.js`
`BASE_CELL_SIZE`, `MIN_ZOOM`, `MAX_ZOOM`, `MAX_UNDO`, `MAX_REWIND`, `MAX_SPARKLINE_POINTS`, `RANDOM_FILL_DENSITY`, `WRAP_BOUNDS`, `SPEED_PRESETS`, `TOOL_ORDER`, `RULESETS`, `PALETTES`, `THEMES`

### `utils.js`
`keyFromXY`, `xyFromKey`, `cloneMapEntries`, `mod`, `clamp`, `capitalize`, `hexToRgb`, `rgbToHex`, `mixColor`

### `patterns.js`
`PATTERNS`, `CATEGORY_OPTIONS`

### `state.js`
`state`, `audioState`, `els`, `canvasRefs`

### `rules.js`
`compileRule`, `canonicalizeRule`, `applyRule`, `getRuleLabel`

`applyRule` returns `{ success: true, rule } | { success: false, message }`. Callers (`app.js`, `io.js`) surface the message via `showToast` and call `updateUI()` to project state to DOM.

### `themes.js`
`getTheme`, `generateCustomPalette`, `getPaletteColors`, `setTheme`

`setTheme` is state-only: updates `state.themeIndex` / `state.paletteId` / `state.accent`. The 15 CSS custom properties + `colorScheme` + `accentPicker` sync live in `ui.applyThemeToDOM()`; every caller of `setTheme` should pair it with that call.

### `history.js`
`setCellAge`, `pushPopulation`, `captureSnapshot`, `pushSimulationSnapshot`, `restoreSnapshot`, `truncateHistoryToCursor`, `pushUndoEntry`, `commitDiffFromMaps`, `undo`, `redo`

`undo` and `redo` return `{ success: true } | { success: false, message }`.

### `sim.js`
`normalizeWrappedCoord`, `normalizeKeyForState`, `computeNeighborCountMap`, `animateDeaths`, `updateFadeAnimations`, `stepSimulation`, `resetSimulation`, `randomFill`, `addCells`, `commitStroke`, `updateSimulation`

`randomFill(visibleBounds)` takes the wrap-off viewport as a required parameter (throws if `state.wrap` is false and `visibleBounds` is missing). Returns `{ message }` so the caller can surface the toast.

### `tools.js`
`getCurrentPattern`, `getPatternCenter`, `getPatternOffsetCells`, `dedupeCells`, `buildLineCells`, `buildBoxCells`, `buildCircleCells`, `getToolCells`, `setTool`, `selectPattern`

`setTool` and `selectPattern` mutate state only; callers call `updateUI()` to project to DOM.

### `audio.js`
`getAudioContext`, `syncAudioState`, `emitStepSound`

### `render.js`
`ensureCanvasSize`, `worldToScreen`, `screenToWorld`, `visibleWorldBounds`, `drawRoundedRect`, `drawSparkline`, `draw`, `updateParticles`, `drawPatternPreview`

`ensureCanvasSize(dpr)` takes DPR as a required parameter (throws on missing / non-positive). `drawCells` / `drawGhostPreview` internally bucket cells by (color, alpha) and use a private `addRoundedRectPath` helper instead of the public `drawRoundedRect` (which remains for single-cell callers like `drawPatternPreview`).

### `io.js`
`exportToJson`, `exportToRle`, `parseRLE`, `importJson`, `importRle`

`importJson` and `importRle` validate the imported rule string before mutating `state.liveCells`; an invalid rule throws before any state write.

### `input.js`
`beginInteraction`, `updateInteraction`, `endInteraction`, `zoomAt`, `autoFit`

`autoFit` mutates camera state only; callers call `updateUI()`. Keyboard dispatch lives in `app.handleKeydown` (not here) so `input.js` has no upward imports.

### `ui.js`
`showToast`, `copyText`, `openModal`, `closeModal`, `closeTopModal`, `isModalOpen`, `adjustSpeed`, `closeSpeedPopover`, `openSpeedPopover`, `toggleSpeedPopover`, `closeRulePopover`, `openInspector`, `closeInspector`, `toggleInspector`, `renderPatternCard`, `showSparklinePopover`, `hideSparklinePopover`, `renderPatternBrowser`, `setupUI`, `updateUI`, `updatePerformanceCounters`, `cycleTheme`, `applyThemeToDOM`, `hexToRgb` (re-export)

`closeSpeedPopover({ restoreFocus })` returns focus to the chip on keyboard-driven close; outside-click dismissals pass `restoreFocus: false`. `openModal` installs a Tab-trap that wraps focus within the modal; `closeModal` restores focus to whatever had it when the modal opened.

### `app.js`
No exports. Side-effects only: attaches `window.render_game_to_text`, `window.advanceTime`, `window.__gameOfLifeV2`; binds events (including `handleKeydown` keyboard dispatch); starts the RAF loop.
