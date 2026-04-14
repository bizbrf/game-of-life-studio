# Module map

Tabular reference for the `game-of-life-v2/scripts/` folder. When a signature or dependency shifts, update this file in the same commit.

For narrative context see [../../ARCHITECTURE.md](../../ARCHITECTURE.md).

## Module summary

| # | File | Responsibility | Imports from scripts/ |
|---|---|---|---|
| 1 | `constants.js` | Tunables and tables. Leaf. | — |
| 2 | `utils.js` | Pure helpers. Leaf. | — |
| 3 | `patterns.js` | Pattern data + `parsePattern`. Leaf. | — |
| 4 | `state.js` | Shared mutable store. | `constants`, `rules` |
| 5 | `rules.js` | B/S rule parse, compile, apply. | `constants`, `state`, `ui`* |
| 6 | `themes.js` | Theme + palette switching. | `constants`, `state`, `utils` |
| 7 | `history.js` | Undo/redo + rewind snapshots. | `constants`, `state`, `utils` |
| 8 | `sim.js` | Simulation step, reset, random fill. | `constants`, `state`, `utils` |
| 9 | `tools.js` | Drawing tool geometry + selection. | `patterns`, `state`, `utils` |
| 10 | `audio.js` | Ambient hum + step sound. | `state` |
| 11 | `render.js` | Canvas draw, coords, particles, sparkline. | `constants`, `state`, `utils` |
| 12 | `io.js` | RLE + JSON import/export. | `state`, `utils`, `rules` |
| 13 | `input.js` | Pointer/touch/keyboard, zoom, autoFit. | `constants`, `state`, `utils` |
| 14 | `ui.js` | DOM wiring — toolbar, inspector, modals. | `constants`, `state`, `utils`, `themes`, `tools`, `history`, `rules` |
| 15 | `app.js` | Entry point, event binding, RAF loop. | everything |

\* `rules.js → ui.js` is a known wart (see [ARCHITECTURE.md § Known warts](../../ARCHITECTURE.md#known-warts)).

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

### `themes.js`
`getTheme`, `generateCustomPalette`, `getPaletteColors`, `setTheme`

### `history.js`
`setCellAge`, `pushPopulation`, `captureSnapshot`, `pushSimulationSnapshot`, `restoreSnapshot`, `truncateHistoryToCursor`, `pushUndoEntry`, `commitDiffFromMaps`, `undo`, `redo`

### `sim.js`
`normalizeWrappedCoord`, `normalizeKeyForState`, `computeNeighborCountMap`, `animateDeaths`, `updateFadeAnimations`, `stepSimulation`, `resetSimulation`, `randomFill`, `addCells`, `updateSimulation`

### `tools.js`
`getCurrentPattern`, `getPatternCenter`, `getPatternOffsetCells`, `dedupeCells`, `buildLineCells`, `buildBoxCells`, `buildCircleCells`, `getToolCells`, `setTool`, `selectPattern`

### `audio.js`
`getAudioContext`, `syncAudioState`, `emitStepSound`

### `render.js`
`ensureCanvasSize`, `worldToScreen`, `screenToWorld`, `visibleWorldBounds`, `drawRoundedRect`, `drawSparkline`, `draw`, `updateParticles`, `drawPatternPreview`

### `io.js`
`exportToJson`, `exportToRle`, `parseRLE`, `importJson`, `importRle`

### `input.js`
`beginInteraction`, `updateInteraction`, `endInteraction`, `zoomAt`, `autoFit`, `handleKeydown`

### `ui.js`
`showToast`, `copyText`, `openModal`, `closeModal`, `closeTopModal`, `isModalOpen`, `adjustSpeed`, `closeSpeedPopover`, `openSpeedPopover`, `toggleSpeedPopover`, `openInspector`, `closeInspector`, `toggleInspector`, `renderPatternCard`, `showSparklinePopover`, `hideSparklinePopover`, `renderPatternBrowser`, `setupUI`, `updateUI`, `updatePerformanceCounters`, `hexToRgb` (re-export)

### `app.js`
No exports. Side-effects only: attaches `window.render_game_to_text`, `window.advanceTime`, `window.__gameOfLifeV2`; binds events; starts the RAF loop.
