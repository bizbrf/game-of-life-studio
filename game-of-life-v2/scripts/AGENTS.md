# scripts/ — simulation, rendering, and UI logic

Plain ES modules. Loaded by `index.html` as `<script type="module">`. No build step.

## Modules

| File | One-liner |
|---|---|
| `app.js` | Entry point. Hydrates DOM refs, binds events, runs the RAF loop. |
| `state.js` | Shared mutable store (`state`, `audioState`, `els`, `canvasRefs`). |
| `constants.js` | Tunables and tables — zoom bounds, speed presets, rulesets, palettes, themes. |
| `utils.js` | Pure helpers — key encoding, `clamp`, `mod`, colour math. No imports. |
| `patterns.js` | Built-in pattern library (data only + `parsePattern`). |
| `rules.js` | B/S rule parsing, compiling, application. |
| `themes.js` | Theme + palette switching, custom palette generation. |
| `history.js` | Undo/redo stack, simulation snapshot ring, population history. |
| `sim.js` | Simulation step, reset, random fill, neighbour counting, wrap. |
| `tools.js` | Drawing tool geometry (line/box/circle/stamp), tool + pattern selection. |
| `audio.js` | Ambient hum + step sound. Lazy-inits AudioContext. |
| `render.js` | Canvas rendering, world↔screen coords, particles, sparkline, pattern preview. |
| `io.js` | RLE and JSON import/export. |
| `input.js` | Pointer/touch interaction, zoom, autoFit. Keyboard dispatch lives in `app.js`. |
| `ui.js` | DOM wiring — toolbar, inspector, popovers, modals, toasts. |

## Rules

- **One responsibility per file.** Do not mix sim logic into render, or UI wiring into sim. The names above are contracts.
- **`state.js` is the only store.** Do not create parallel state in other modules. If you need derived state, compute it where it's used or add a selector helper to `state.js`.
- **`utils.js` has no imports.** It is pure. Keep it that way.
- **Do not import from `ui.js` in middle-layer modules.** `sim`, `render`, `history`, `io`, `rules`, `themes`, `audio`, `tools`, `input` must not reach into `ui.js`. When a middle-layer operation has a user-facing outcome, return `{ success, message }` or `{ message }`; callers in `app.js` / `ui.js` surface the toast and call `updateUI`. The previous `rules.js → ui.js` exception was resolved in Batch 1 of the code review.
- **No new dependencies.** No bundler, no npm. If a problem needs a library, open an ADR.

## Dependency direction (rough)

```
utils.js, constants.js          (leaves — no imports inside scripts/)
   ↓
state.js, patterns.js
   ↓
rules.js, themes.js, history.js, sim.js, tools.js, audio.js, render.js, io.js, input.js
   ↓
ui.js
   ↓
app.js (entry — imports everything)
```

## Change protocol for this folder

- If you change a module's **exports** or signatures, update [../../docs/agents/module-map.md](../../docs/agents/module-map.md) and [../../ARCHITECTURE.md](../../ARCHITECTURE.md).
- If you add a **new module**, also register it in the map above and in [../../docs/agents/module-map.md](../../docs/agents/module-map.md).
- If the change alters **data flow or invariants** (e.g. how cells are stored, how rewind works), open a new ADR.

## Common mistakes

- Putting DOM access outside `ui.js` or `app.js`. Other modules should not reach for `document`.
- Allocating new state objects instead of mutating `state`. The RAF loop assumes shared mutable state.
- Adding `console.log` debugging and forgetting to remove it. The verification step catches this.
- Calling `showToast` or `updateUI` from a middle-layer module. Instead, return a result object and let `app.js` / `ui.js` surface it.
