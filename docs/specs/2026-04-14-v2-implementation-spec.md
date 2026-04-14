# Game of Life v2 — Implementation Specification

## Tech Stack Decision

**Web (HTML + CSS + JavaScript + Canvas)** — NOT Pygame.

Rationale:
- Glassmorphism, backdrop-filter blur, CSS transitions, and modern typography are native to web
- Canvas API handles grid rendering efficiently; WebGL optional for massive grids
- No install required — opens in browser
- Touch/mobile support for free
- The Apple/OpenAI/Anthropic aesthetic is fundamentally a web design language

Structure: Single `index.html` file with embedded `<style>` and `<script>` sections (keep it self-contained and easy to open).

---

## Design Language — Apple × OpenAI × Anthropic Aesthetic

### Visual Identity
- **Dark mode default** — charcoal background (#0a0a0a to #1a1a1a), not pure black
- **Glassmorphism panels** — semi-transparent backgrounds with `backdrop-filter: blur(20px)`, subtle white/gray borders (1px, 8% opacity)
- **Typography** — `SF Pro Display`, `-apple-system`, `Inter`, `system-ui` fallback stack. Light weight (300-400) for body, medium (500) for labels, semibold (600) for headings
- **Spacing** — Generous whitespace, 8px grid system, 12-16px border-radius on panels
- **Colors** — Muted palette with one accent color. Think:
  - Background: `#0a0a0a` (dark) / `#fafafa` (light)
  - Surface: `rgba(255,255,255,0.05)` glass panels
  - Text primary: `rgba(255,255,255,0.9)`
  - Text secondary: `rgba(255,255,255,0.5)`
  - Accent: `#6366f1` (indigo) or `#8b5cf6` (violet) — adjustable
  - Cell alive: white or accent fade based on age
  - Cell dead: transparent
- **Shadows** — Very subtle, layered: `0 2px 8px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.1)`
- **Animations** — Smooth 200-300ms ease transitions on all interactive elements, spring physics on toggles
- **Icons** — Minimal line icons or SF Symbols-style, no heavy icon libraries

### Layout
- **Full-viewport canvas** — grid fills the entire browser window
- **Floating control panel** — glassmorphism sidebar or bottom bar that can be collapsed/hidden
- **Floating toolbar** — top-left or bottom-center with primary controls (play/pause/step/reset)
- **No traditional sidebar** — controls float over the canvas

---

## V1 Features to Preserve (ALL)

1. ✅ Conway's Game of Life rules (B3/S23)
2. ✅ Cell aging (cells track how many generations alive → affects color)
3. ✅ 13 classic patterns: Freehand, Glider, LWSS, Pulsar, R-Pentomino, Gosper Gun, Acorn, Diehard, Blinker, Toad, Beacon, Block, Beehive
4. ✅ Pattern ghost preview (semi-transparent preview follows cursor before stamping)
5. ✅ Left click/drag to paint, right click/drag to erase
6. ✅ Space to play/pause
7. ✅ N to step one generation (while paused)
8. ✅ R to reset grid
9. ✅ F for random fill (~25%)
10. ✅ G to toggle grid lines
11. ✅ W to toggle edge wrapping (toroidal)
12. ✅ T to cycle themes
13. ✅ +/- or scroll to adjust speed
14. ✅ Tab/Shift+Tab to cycle patterns
15. ✅ H for help overlay
16. ✅ Esc to quit/close help
17. ✅ Live stats: generation count, population, speed
18. ✅ Multiple visual themes (at least 4 distinct themes)
19. ✅ Speed control with accumulator-based timing (decoupled from render FPS)
20. ✅ Simulation state indicator (running/paused with animation)

---

## V2 New Features

### Tier 1 — Core Additions
1. **Infinite pan & zoom** — Mouse wheel to zoom in/out, click+drag middle mouse or two-finger to pan. Grid is conceptually infinite (use sparse data structure — Map/Set of alive cell coords instead of 2D array)
2. **Zoom-to-fit** — Double-click or button to auto-zoom to fit all living cells
3. **Drawing tools palette** — Line tool, box/rectangle tool, circle tool (in addition to freehand and pattern stamp)
4. **Undo/Redo** — Ctrl+Z / Ctrl+Shift+Z with history stack (store diffs, not full grids)
5. **Population graph** — Small sparkline in the stats panel showing population over last ~200 generations
6. **Generation history / rewind** — Slider or button to step backwards. Store last N generations.

### Tier 2 — Power Features
7. **Multiple rulesets** — Not just Conway's B3/S23. Support:
   - HighLife (B36/S23) — has a replicator
   - Day & Night (B3678/S34678)
   - Seeds (B2/S)
   - Life without Death (B3/S012345678)
   - Custom rule entry (B/S notation input field)
8. **Pattern library browser** — Searchable dropdown/modal with pattern previews, categorized (Still Lifes, Oscillators, Spaceships, Methuselahs, Guns)
9. **Import/Export** — Export current state as RLE format or JSON. Import RLE patterns. Copy to clipboard.
10. **Speed presets** — Named speeds: Slow (5/s), Normal (15/s), Fast (30/s), Turbo (60/s), Max (uncapped requestAnimationFrame)

### Tier 3 — Polish & Delight
11. **Smooth cell transitions** — Cells fade in/out over 1-2 frames instead of instant on/off
12. **Ambient particle effects** — Optional subtle floating particles in background (like Anthropic's website)
13. **Sound design** — Optional subtle ambient sound/clicks (off by default, toggle-able). Soft tick on cell birth, gentle hum while simulating.
14. **Touch support** — Pinch to zoom, one-finger to draw, two-finger to pan (mobile/tablet)
15. **Responsive layout** — Control panel repositions on narrow screens
16. **Keyboard shortcut cheat sheet** — Press `?` for a beautiful modal showing all shortcuts
17. **Performance stats** — Optional FPS counter and generation rate display
18. **Light/Dark mode toggle** — System default detection + manual toggle
19. **Cell color themes** — Multiple age-based color gradients:
    - Mono (white → gray)
    - Ocean (cyan → deep blue)
    - Ember (yellow → orange → red)
    - Aurora (green → teal → purple)
    - Custom accent color picker

---

## Architecture

```
index.html (single file, self-contained)
├── <style> — All CSS (glassmorphism, layout, animations, theme variables)
├── <canvas> — Main simulation canvas (full viewport)
├── <div id="controls"> — Floating glassmorphism control panel
│   ├── Play/Pause/Step/Reset buttons
│   ├── Speed slider
│   ├── Pattern selector
│   ├── Tool selector (freehand/line/box/circle/eraser)
│   ├── Rule selector dropdown
│   ├── Toggles (grid, wrap, sound, particles)
│   ├── Stats (gen, pop, fps, sparkline)
│   └── Theme selector
├── <div id="help-modal"> — Keyboard shortcuts modal
├── <div id="pattern-browser"> — Pattern library modal
└── <script>
    ├── // === CONFIG & STATE ===
    ├── // Grid state (Map-based sparse grid for infinite support)
    ├── // Camera state (offsetX, offsetY, zoom)
    ├── // History stack for undo/redo
    ├──
    ├── // === SIMULATION ENGINE ===
    ├── // step() — apply rules to sparse grid
    ├── // countNeighbors() — with wrap option
    ├── // applyRule(born, survive) — generic B/S rule engine
    ├──
    ├── // === RENDERING ===
    ├── // drawGrid() — render visible cells from camera viewport
    ├── // drawGhostPreview() — pattern preview at cursor
    ├── // drawSparkline() — population history graph
    ├── // applyTheme() — switch CSS variables + cell colors
    ├──
    ├── // === INPUT HANDLING ===
    ├── // Mouse: paint, erase, pan, zoom
    ├── // Keyboard: all v1 shortcuts + new ones
    ├── // Touch: pinch zoom, draw, pan
    ├──
    ├── // === TOOLS ===
    ├── // Freehand, Line, Box, Circle drawing tools
    ├── // Pattern stamp with ghost preview
    ├──
    ├── // === PATTERNS ===
    ├── // All 13 v1 patterns + additional library
    ├──
    ├── // === IMPORT/EXPORT ===
    ├── // RLE parser/writer
    ├── // JSON export/import
    ├──
    ├── // === GAME LOOP ===
    ├── // requestAnimationFrame loop
    ├── // Accumulator-based simulation timing
    └── // FPS tracking
```

---

## Themes (CSS Custom Properties)

Each theme sets `--bg`, `--surface`, `--border`, `--text`, `--text-dim`, `--accent`, and cell color arrays.

### 1. Obsidian (default dark — Anthropic/OpenAI vibe)
- Deep charcoal, violet accent, white cells aging to indigo
- Glassmorphism panels, subtle vignette

### 2. Ivory (light mode — Apple vibe)
- Near-white background, dark cells, blue accent
- Clean, minimal, lots of breathing room

### 3. Terminal (hacker)
- Pure black, green monospace text, matrix vibes

### 4. Cosmos (celestial)
- Deep navy, gold/purple cells, star-like dots

---

## Key Implementation Notes

- **Sparse grid**: Use `Map` with string keys like `"x,y"` for alive cells with age values. This enables infinite grid and efficient neighbor counting.
- **Camera transform**: All rendering goes through `worldToScreen(x, y)` and `screenToWorld(x, y)` transforms using offset + zoom.
- **Cell size**: Base cell size = 12px, adjusted by zoom level. Draw rounded rects with 2px radius.
- **Grid lines**: Thin lines (0.5px) at low opacity, only drawn in visible viewport.
- **Accumulator timing**: Same pattern as v1 — decouple sim speed from render FPS.
- **History**: Store generation snapshots as Sets of alive cell keys. Keep last 50 for rewind. Diffs for undo (only changed cells).
- **Pattern preview**: Semi-transparent accent color cells following cursor, pulsing alpha.
- **Responsive**: Control panel is a floating card. On narrow screens (<768px), moves to bottom sheet.
- **Performance**: For large populations, skip glow/blur effects. Use `requestAnimationFrame`. Batch canvas draws.
