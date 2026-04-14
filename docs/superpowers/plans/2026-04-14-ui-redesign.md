# UI Redesign (B+A Hybrid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on verification:** This project has no unit test framework. Each phase is verified with a Playwright browser check running against `http://127.0.0.1:8765/game-of-life-v2/index.html`. The existing temp setup at `%TEMP%\gol-ui-check` is reused. Phases do not commit (the project is not a git repo); each phase is reviewed via the browser check output.

**Goal:** Replace the current three-panel UI (`#toolbar` + `#controls-panel` + `#stats-panel`) with a single status strip, a bottom-center playback pill, and a right-slide inspector drawer.

**Architecture:** Preserve all existing ES modules. Rewrite `index.html` body (keeping modals and canvas) and `styles/main.css` layout rules; update `ui.js` / `app.js` / `input.js` / `state.js` to match the new DOM. Pure-logic modules (`sim`, `history`, `rules`, `io`, `utils`, `patterns`, `constants`, `audio`, `themes`, `tools`) are untouched.

**Tech Stack:** Plain HTML + ES modules + CSS custom properties. No build step. Playwright (Chromium) from `%TEMP%\gol-ui-check` for verification.

**Reference spec:** [docs/superpowers/specs/2026-04-14-ui-redesign-design.md](../specs/2026-04-14-ui-redesign-design.md)

---

## File structure

| File | Role | Change |
| --- | --- | --- |
| `game-of-life-v2/index.html` | DOM structure | rewrite body (keep modals, canvas, toast layer) |
| `game-of-life-v2/styles/main.css` | Layout + tokens + components | major rewrite; keep tokens/typography; replace panel/accordion rules with status-strip/playback-pill/inspector/theme-swatch rules; reduce blur/shadow intensity |
| `game-of-life-v2/scripts/state.js` | Shared state | add `state.inspectorOpen`; update `els` keys added later by app.js |
| `game-of-life-v2/scripts/app.js` | DOM hydration + event binding | update `hydrateDomReferences` for new IDs; replace panel-specific event handlers; add Ctrl+K handler via input.js |
| `game-of-life-v2/scripts/ui.js` | UI state sync | rewrite `setupUI` (new segmented tools, theme swatch rendering, scene row, sparkline popover wiring); rewrite `updateUI` for new element set; add `openInspector`/`closeInspector`/`toggleInspector`, `openSpeedPopover`/`openRulePopover`/`openSparklinePopover` |
| `game-of-life-v2/scripts/input.js` | Keyboard | add Ctrl/Cmd+K; adjust Esc priority |
| `C:\Users\chase\AppData\Local\Temp\gol-ui-check\check-redesign.js` | Verification harness | new Playwright script; 11 assertions per spec |
| `progress.md` | Changelog | append redesign notes after final verification |

Pure-logic modules unchanged: `constants.js`, `utils.js`, `patterns.js`, `rules.js`, `themes.js`, `sim.js`, `history.js`, `tools.js`, `audio.js`, `render.js`, `io.js`.

---

## Phase A — CSS foundation

**Files:**
- Modify: `game-of-life-v2/styles/main.css`

### Task A.1: Add status strip styles

- [ ] **Step 1: Append status strip rules to `main.css` (after existing `.toolbar` rules, before media queries)**

Append the following CSS:

```css
/* === Status strip (top-left) === */
.status-strip {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  letter-spacing: 0.005em;
  font-variant-numeric: tabular-nums;
  pointer-events: auto;
  z-index: 6;
}
.status-strip .dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--danger);
}
body.simulating .status-strip .dot {
  background: var(--success);
  animation: pulse 1.6s ease infinite;
}
body.rewinding .status-strip .dot {
  background: #f7c76d;
}
.status-strip .rule-name {
  cursor: pointer;
  color: var(--text);
}
.status-strip .sep {
  opacity: 0.35;
}
.status-strip .pop-token {
  cursor: help;
}
```

### Task A.2: Add playback pill styles

- [ ] **Step 2: Append playback pill rules**

```css
/* === Playback pill (bottom-center) === */
.playback-pill {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 6;
  transition: transform 160ms ease, background 180ms ease;
}
.playback-pill:hover {
  transform: translateX(-50%) scale(1.015);
}
.playback-pill .pill-btn {
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background 160ms ease;
}
.playback-pill .pill-btn:hover {
  background: rgba(255,255,255,0.06);
}
.playback-pill .pill-btn.primary {
  background: rgba(var(--accent-rgb), 0.2);
  border-color: rgba(var(--accent-rgb), 0.42);
  color: #fff;
  min-width: 64px;
}
.playback-pill .pill-btn.primary:hover {
  background: rgba(var(--accent-rgb), 0.28);
}
.playback-pill .pill-btn.ghost {
  color: var(--text-dim);
}
.playback-pill .pill-btn[disabled] {
  opacity: 0.4;
  pointer-events: none;
}
.playback-pill .pill-divider {
  width: 1px;
  height: 18px;
  background: rgba(255,255,255,0.1);
  margin: 0 2px;
}
.playback-pill .speed-chip {
  font-variant-numeric: tabular-nums;
  min-width: 56px;
}
.shortcut-hint {
  position: absolute;
  bottom: 18px;
  right: 18px;
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  pointer-events: none;
  z-index: 5;
  font-family: var(--font-mono);
}
.shortcut-hint kbd {
  font-family: var(--font-mono);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 10.5px;
}
```

### Task A.3: Add inspector drawer styles

- [ ] **Step 3: Append inspector drawer rules**

```css
/* === Inspector drawer (right) === */
.inspector {
  position: absolute;
  top: 12px;
  right: 12px;
  bottom: 12px;
  width: 340px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  padding: 20px 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: hidden;
  z-index: 12;
  transform: translateX(calc(100% + 20px));
  opacity: 0;
  pointer-events: none;
  transition:
    transform 360ms cubic-bezier(0.25, 0.85, 0.4, 1),
    opacity 260ms ease;
}
.inspector.open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}
.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
}
.inspector-header .inspector-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.005em;
}
.inspector-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
.inspector-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.inspector-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--text-dim);
  text-transform: uppercase;
}
.inspector .scene-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.inspector .scene-row button {
  min-height: 58px;
  padding: 8px 4px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text);
  font-size: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: background 160ms ease, transform 140ms ease;
}
.inspector .scene-row button:hover {
  background: rgba(255,255,255,0.08);
  transform: translateY(-1px);
}
.inspector .scene-row button svg {
  width: 16px;
  height: 16px;
  stroke: var(--text);
  stroke-width: 1.5;
  fill: none;
}
.inspector .tool-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
.inspector .tool-grid button {
  min-height: 42px;
  padding: 0;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.inspector .tool-grid button svg {
  width: 18px;
  height: 18px;
  stroke: var(--text);
  stroke-width: 1.5;
  fill: none;
}
.inspector .tool-grid button.active {
  background: rgba(var(--accent-rgb), 0.2);
  border-color: rgba(var(--accent-rgb), 0.42);
}
.inspector .tool-active-label {
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}
.inspector .pattern-card {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: background 160ms ease;
}
.inspector .pattern-card:hover {
  background: rgba(255,255,255,0.08);
}
.inspector .pattern-card canvas {
  width: 88px;
  height: 56px;
  border-radius: 10px;
  background: rgba(0,0,0,0.24);
}
.inspector .pattern-card .pattern-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.inspector .pattern-card .pattern-name {
  font-size: 14px;
  font-weight: 600;
}
.inspector .pattern-card .pattern-category {
  font-size: 11px;
  color: var(--text-dim);
}
.inspector .rule-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.inspector .rule-picker .rule-select {
  width: 100%;
  border-radius: 12px;
  background: rgba(0,0,0,0.18);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 12px;
  font-size: 13px;
}
.inspector .theme-swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.inspector .theme-swatches .theme-swatch {
  position: relative;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer;
  overflow: hidden;
  transition: transform 160ms ease, border-color 180ms ease;
}
.inspector .theme-swatches .theme-swatch:hover {
  transform: translateY(-1px);
}
.inspector .theme-swatches .theme-swatch.active {
  border-color: rgba(var(--accent-rgb), 0.65);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.22);
}
.inspector .theme-swatches .theme-swatch::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08));
}
.inspector .advanced-toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.inspector .advanced-toggles button {
  min-height: 36px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
  transition: background 160ms ease;
}
.inspector .advanced-toggles button.active {
  background: rgba(var(--accent-rgb), 0.2);
  border-color: rgba(var(--accent-rgb), 0.42);
  color: #fff;
}
.inspector .advanced-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.inspector .advanced-row .label {
  font-size: 11px;
  color: var(--text-dim);
  min-width: 60px;
}
.inspector .advanced-row input[type="color"] {
  width: 44px;
  height: 32px;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(0,0,0,0.2);
}
.inspector .history-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.inspector .history-row button {
  min-height: 34px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.inspector .history-row button[disabled] {
  opacity: 0.4;
  pointer-events: none;
}
.inspector details > summary {
  list-style: none;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 6px 0;
}
.inspector details > summary::-webkit-details-marker {
  display: none;
}
.inspector details > summary::after {
  content: "＋";
  opacity: 0.55;
}
.inspector details[open] > summary::after {
  content: "−";
}
.inspector details[open] > .details-body {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.inspector details > .details-body {
  display: none;
}
```

### Task A.4: Add sparkline popover + backdrop + helpers

- [ ] **Step 4: Append sparkline popover, popovers, backdrop styles**

```css
/* === Sparkline popover over Pop token === */
.sparkline-popover {
  position: absolute;
  top: 52px;
  left: 12px;
  width: 220px;
  padding: 12px;
  border-radius: 14px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 9;
  display: none;
  pointer-events: none;
}
.sparkline-popover.visible {
  display: block;
}
.sparkline-popover canvas {
  width: 100%;
  height: 56px;
  display: block;
}
.sparkline-popover .label {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 6px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* === Speed / rule popovers anchored to pill === */
.popover {
  position: absolute;
  padding: 8px;
  min-width: 200px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  z-index: 14;
  display: none;
}
.popover.visible {
  display: grid;
  gap: 6px;
}
.popover .option {
  text-align: left;
  padding: 8px 10px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.popover .option:hover {
  background: rgba(255,255,255,0.07);
}
.popover .option.selected {
  background: rgba(var(--accent-rgb), 0.18);
  border-color: rgba(var(--accent-rgb), 0.32);
}
.popover .option .meta {
  color: var(--text-dim);
  font-size: 11px;
}
.popover .custom-row {
  display: grid;
  gap: 6px;
  padding: 6px 4px 2px;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 4px;
}
.popover .custom-row input {
  width: 100%;
  border-radius: 10px;
  background: rgba(0,0,0,0.18);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 8px 10px;
  font-size: 12px;
}

/* Backdrop (only dims area right of canvas when inspector is open; not used full-screen by default) */
.inspector-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 6, 12, 0.18);
  opacity: 0;
  pointer-events: none;
  transition: opacity 240ms ease;
  z-index: 10;
}
body.inspector-open .inspector-backdrop {
  opacity: 1;
  pointer-events: auto;
}
```

### Task A.5: Remove obsolete styles

- [ ] **Step 5: Delete the rules for old panels that are being replaced**

Search `main.css` for and delete these blocks (they're no longer referenced — new DOM omits their classes):

- `.toolbar { ... }` block (lines around where `.toolbar` is declared with positioning)
- `.controls-panel { ... }` block
- `.stats-panel { ... }` block
- `.toolbar-topline { ... }`
- `.transport-strip { ... }`
- `.toolbar-meta { ... }` / `.toolbar-live { ... }` / `.toolbar-chips { ... }`
- `.toolbar-menu { ... }` / `.toolbar-menu.hidden { ... }`
- `.stats-inline { ... }`
- `.stats-title-row { ... }`
- `.history-toggle-button { ... }`
- `.panel-accordion { ... }` / `.accordion-summary { ... }` / `.accordion-body { ... }`
- `#toolbar .eyebrow { margin-bottom: -1px; }`
- `.stat-grid { ... }` / `.stat-card { ... }` / `.stat-value { ... }`
- `.sparkline-wrap { ... }` (replaced by `.sparkline-popover`)
- `.rewind-row { ... }` / `.rewind-labels { ... }` (rewind lives in Advanced details now)
- `.status-pill { ... }` / `.status-dot { ... }` (status moves to `.status-strip .dot`)
- `.eyebrow` / `.label` / `.stat-label` selectors may be reduced; keep `.label` generic (used by modals) but delete `.eyebrow` and `.stat-label`
- `.floating { ... }` (no longer used — inspector, status-strip, pill have their own backgrounds)

Also reduce `--shadow`:
```css
/* inside :root */
--shadow: 0 14px 40px rgba(2, 4, 10, 0.22), 0 1px 0 rgba(255, 255, 255, 0.05) inset;
--panel-blur: blur(18px);
```

Media-query rules for these old selectors (at `@media (max-width: 900px)` and `(max-width: 768px)`) should also be removed; mobile behavior for new layout is added in Phase E.

### Task A.6: Verify CSS loads with no selector errors

- [ ] **Step 6: Load the page in the browser and confirm no 404s or CSS parse errors**

Page won't look right yet (old IDs still in `index.html`) — that's expected. We just need the CSS file to load cleanly. Run:

```bash
cd "$TEMP/gol-ui-check" && node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('requestfailed', r => errors.push('failed ' + r.url()));
  await p.goto('http://127.0.0.1:8765/game-of-life-v2/index.html');
  await p.waitForTimeout(500);
  console.log('errors:', errors.join('|') || 'none');
  await b.close();
})();
"
```

Expected: `errors: none` (JS errors may appear if we're mid-phase, but no CSS/network failures).

---

## Phase B — DOM skeleton

**Files:**
- Modify: `game-of-life-v2/index.html`

### Task B.1: Replace body panels with new DOM

- [ ] **Step 1: Rewrite the body of `index.html`**

Replace the entire body contents (keep `<!DOCTYPE>`, `<head>`, closing `</body></html>`) with:

```html
<body>
  <div id="app">
    <canvas id="life-canvas" aria-label="Game of Life canvas"></canvas>

    <!-- STATUS STRIP -->
    <div class="status-strip" id="status-strip" role="status" aria-live="polite">
      <span class="dot" id="status-dot"></span>
      <span class="rule-name" id="status-rule" role="button" tabindex="0">Conway</span>
      <span class="sep">·</span>
      <span>Gen <span id="status-gen">0</span></span>
      <span class="sep">·</span>
      <span class="pop-token" id="status-pop-token">Pop <span id="status-pop">0</span></span>
    </div>

    <!-- SPARKLINE POPOVER (anchored under status strip) -->
    <div class="sparkline-popover" id="sparkline-popover" role="tooltip">
      <div class="label">Population · last 200 gens</div>
      <canvas id="sparkline" width="220" height="56" aria-label="Population sparkline"></canvas>
    </div>

    <!-- PLAYBACK PILL -->
    <div class="playback-pill" id="playback-pill">
      <button class="pill-btn primary" id="play-toggle" type="button" aria-label="Play or pause">Play</button>
      <button class="pill-btn ghost" id="back-btn" type="button" aria-label="Step backward in history">⇤</button>
      <button class="pill-btn ghost" id="step-btn" type="button" aria-label="Step forward one generation">⇥</button>
      <div class="pill-divider"></div>
      <button class="pill-btn speed-chip" id="speed-chip" type="button" aria-haspopup="true" aria-expanded="false">15/s</button>
      <div class="pill-divider"></div>
      <button class="pill-btn" id="inspector-toggle" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="inspector" aria-label="Open inspector">⚙</button>
    </div>

    <!-- SPEED POPOVER -->
    <div class="popover" id="speed-popover" role="menu" aria-label="Simulation speed"></div>

    <!-- RULE POPOVER -->
    <div class="popover" id="rule-popover" role="menu" aria-label="Rule presets"></div>

    <!-- SHORTCUT HINT -->
    <div class="shortcut-hint"><kbd>⌘K</kbd></div>

    <!-- INSPECTOR BACKDROP -->
    <div class="inspector-backdrop" id="inspector-backdrop"></div>

    <!-- INSPECTOR DRAWER -->
    <aside class="inspector" id="inspector" role="dialog" aria-label="Inspector" aria-hidden="true">
      <div class="inspector-header">
        <div class="inspector-title">Inspector</div>
        <button class="pill-btn" id="inspector-close" type="button" aria-label="Close inspector">✕</button>
      </div>
      <div class="inspector-scroll">

        <!-- Scene row -->
        <section class="inspector-section">
          <div class="inspector-section-label">Scene</div>
          <div class="scene-row">
            <button id="fit-btn" type="button">
              <svg viewBox="0 0 20 20"><path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4" stroke-linecap="round"/></svg>
              Fit
            </button>
            <button id="random-btn" type="button">
              <svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="3"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="7" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1" fill="currentColor" stroke="none"/></svg>
              Random
            </button>
            <button id="reset-btn" type="button">
              <svg viewBox="0 0 20 20"><path d="M4 10a6 6 0 1 0 6-6" stroke-linecap="round"/><path d="M10 2l-3 3 3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Reset
            </button>
            <button id="io-btn" type="button">
              <svg viewBox="0 0 20 20"><path d="M10 3v10M6 9l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 15v2h14v-2" stroke-linecap="round"/></svg>
              I/O
            </button>
            <button id="help-btn" type="button">
              <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7"/><path d="M7.5 7.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.8" fill="currentColor" stroke="none"/></svg>
              Help
            </button>
          </div>
        </section>

        <!-- Tools -->
        <section class="inspector-section">
          <div class="inspector-section-label">Tools</div>
          <div class="tool-grid" id="tool-grid"></div>
          <div class="tool-active-label" id="tool-active-label">Freehand tool active</div>
        </section>

        <!-- Pattern -->
        <section class="inspector-section">
          <div class="inspector-section-label">Pattern</div>
          <button class="pattern-card" id="pattern-card" type="button">
            <canvas id="pattern-card-preview" width="88" height="56"></canvas>
            <div class="pattern-meta">
              <div class="pattern-name" id="pattern-card-name">Freehand</div>
              <div class="pattern-category" id="pattern-card-category">Drawing</div>
            </div>
          </button>
        </section>

        <!-- Rule -->
        <section class="inspector-section">
          <div class="inspector-section-label">Rule</div>
          <div class="rule-picker">
            <select id="ruleset-select" class="rule-select"></select>
            <input id="rule-input" type="text" class="rule-select" value="B3/S23" spellcheck="false" aria-label="Custom B/S rule">
          </div>
        </section>

        <!-- Theme -->
        <section class="inspector-section">
          <div class="inspector-section-label">Theme</div>
          <div class="theme-swatches" id="theme-swatches"></div>
        </section>

        <!-- Advanced -->
        <details class="inspector-section">
          <summary>Advanced</summary>
          <div class="details-body">
            <div class="advanced-toggles" id="toggle-buttons"></div>

            <div class="advanced-row">
              <span class="label">Accent</span>
              <input id="accent-picker" type="color" value="#8d8fff">
            </div>

            <div class="inspector-section-label" style="margin-top:4px;">History</div>
            <div class="history-row">
              <button id="undo-btn" type="button">Undo</button>
              <button id="redo-btn" type="button">Redo</button>
            </div>

            <div class="inspector-section-label" style="margin-top:4px;">Rewind</div>
            <input id="history-slider" type="range" min="0" max="0" value="0" aria-label="Rewind timeline">
            <div class="history-row">
              <button id="history-live-btn" type="button">Return to live</button>
              <button id="history-forward-btn" type="button">Forward</button>
            </div>
          </div>
        </details>

      </div>
    </aside>

    <!-- MODALS (unchanged) -->
    <div class="modal-backdrop" id="help-modal" aria-hidden="true">
      <div class="modal">
        <div class="modal-header panel-row">
          <div class="stack">
            <div class="title">Shortcuts</div>
          </div>
          <button class="icon ghost close-modal" data-close="help-modal" type="button" aria-label="Close help">✕</button>
        </div>
        <div class="shortcuts-grid">
          <div class="shortcut-card">
            <div><kbd>Space</kbd> Play / pause</div>
            <div><kbd>N</kbd> Step while paused</div>
            <div><kbd>R</kbd> Reset</div>
            <div><kbd>F</kbd> Random fill</div>
            <div><kbd>G</kbd> Toggle grid</div>
            <div><kbd>W</kbd> Toggle wrap</div>
            <div><kbd>T</kbd> Cycle themes</div>
            <div><kbd>Tab</kbd> Next pattern · <kbd>Shift+Tab</kbd> previous</div>
            <div><kbd>H</kbd> / <kbd>?</kbd> Help</div>
            <div><kbd>Esc</kbd> Close overlays</div>
          </div>
          <div class="shortcut-card">
            <div><kbd>Wheel</kbd> Zoom canvas</div>
            <div><kbd>Shift+Wheel</kbd> Adjust speed</div>
            <div><kbd>Middle Drag</kbd> Pan</div>
            <div><kbd>Double Click</kbd> Zoom to fit</div>
            <div><kbd>Ctrl+Z</kbd> Undo · <kbd>Ctrl+Shift+Z</kbd> Redo</div>
            <div><kbd>Ctrl+K</kbd> Toggle inspector</div>
            <div><kbd>1–6</kbd> Tools</div>
            <div><kbd>[ ]</kbd> Speed down / up</div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" id="pattern-modal" aria-hidden="true">
      <div class="modal large">
        <div class="modal-header panel-row">
          <div class="stack">
            <div class="title">Pattern Library</div>
          </div>
          <button class="icon ghost close-modal" data-close="pattern-modal" type="button" aria-label="Close pattern library">✕</button>
        </div>
        <div class="input-grid">
          <label class="stack">
            <span class="label">Search</span>
            <input id="pattern-search" type="text" placeholder="Glider, gun, oscillator..." spellcheck="false">
          </label>
          <label class="stack">
            <span class="label">Category</span>
            <select id="pattern-category"></select>
          </label>
        </div>
        <div class="pattern-preview-grid" id="pattern-browser-grid"></div>
      </div>
    </div>

    <div class="modal-backdrop" id="io-modal" aria-hidden="true">
      <div class="modal large">
        <div class="modal-header panel-row">
          <div class="stack">
            <div class="title">Import / Export</div>
          </div>
          <button class="icon ghost close-modal" data-close="io-modal" type="button" aria-label="Close import export">✕</button>
        </div>
        <div class="modal-grid">
          <section class="panel-section">
            <div class="stack">
              <div class="label">Import</div>
              <div class="subtitle">Paste RLE or exported JSON, then place it at the camera center or merge it into the current world.</div>
            </div>
            <textarea id="import-text" placeholder="x = 3, y = 3, rule = B3/S23&#10;bo$2bo$3o!"></textarea>
            <div class="button-row">
              <button id="import-rle-btn" type="button">Import RLE</button>
              <button id="import-json-btn" type="button">Import JSON</button>
              <button id="upload-btn" type="button">Load File</button>
            </div>
          </section>
          <section class="panel-section">
            <div class="stack">
              <div class="label">Export</div>
              <div class="subtitle">Create portable RLE or JSON from the current sparse grid.</div>
            </div>
            <textarea id="export-text" readonly placeholder="Export output appears here."></textarea>
            <div class="button-row">
              <button id="export-rle-btn" type="button">Export RLE</button>
              <button id="export-json-btn" type="button">Export JSON</button>
              <button id="copy-export-btn" type="button">Copy</button>
            </div>
            <div class="modal-note" id="export-note">Exports use the currently active ruleset.</div>
          </section>
        </div>
      </div>
    </div>

    <div class="toast-layer" id="toast-layer" aria-live="polite"></div>
    <input class="visually-hidden" id="file-input" type="file" accept=".rle,.txt,.json">
  </div>
  <script type="module" src="scripts/app.js"></script>
</body>
```

Note the renames/consolidations:
- `#life-canvas` unchanged
- `#sparkline` now inside `#sparkline-popover`
- `#play-toggle`, `#step-btn`, `#back-btn`, `#fit-btn`, `#random-btn`, `#reset-btn`, `#undo-btn`, `#redo-btn`, `#help-btn`, `#io-btn` — IDs preserved
- `#browser-btn` (old) → removed; the `#pattern-card` replaces it
- `#scene-menu-btn`, `#scene-menu`, `#controls-toggle`, `#collapse-controls`, `#mode-toggle` — removed
- `#controls-panel`, `#toolbar`, `#stats-panel`, `#status-pill`, `#status-text`, `#mini-title`, `#mini-subtitle`, `#mini-meta`, `#stats-title`, `#speed-chip` (old chip), `#rate-chip`, `#fps-chip`, `#generation-value`, `#population-value`, `#rewind-label`, `#rewind-count`, `#sparkline-meta`, `#speed-presets`, `#pattern-select`, `#palette-select`, `#speed-slider` — removed (their data now flows into: status-strip text, sparkline popover, speed popover, theme swatches, pattern card)
- `#tool-buttons` → `#tool-grid` (new selector for new DOM)
- `#toggle-buttons` — kept
- `#ruleset-select`, `#rule-input`, `#accent-picker`, `#history-slider`, `#history-live-btn`, `#history-forward-btn` — IDs preserved
- `#speed-chip` is now the playback pill's chip (different semantics from old `.stats-panel` chip)
- `#inspector`, `#inspector-toggle`, `#inspector-close`, `#inspector-backdrop`, `#speed-popover`, `#rule-popover`, `#sparkline-popover`, `#status-dot`, `#status-rule`, `#status-gen`, `#status-pop`, `#status-pop-token`, `#theme-swatches`, `#pattern-card`, `#pattern-card-preview`, `#pattern-card-name`, `#pattern-card-category`, `#tool-active-label` — new

### Task B.2: Browser smoke check after DOM rewrite

- [ ] **Step 2: Load page and confirm CSS applies to new DOM**

App will not function yet (JS hydration still points at old IDs). But layout should look approximately correct.

Run the Phase A check command. Expected: the inspector is hidden off-screen, status strip shows "Conway · Gen 0 · Pop 0", playback pill visible bottom-center with raw text. Acceptable JS errors from `hydrateDomReferences` looking for removed IDs.

---

## Phase C — State + hydration update

**Files:**
- Modify: `game-of-life-v2/scripts/state.js`
- Modify: `game-of-life-v2/scripts/app.js`

### Task C.1: Add `inspectorOpen` to state

- [ ] **Step 1: Add field to `state.js`**

In `scripts/state.js`, inside the `state` object literal, add (after `modals: new Set(),`):

```javascript
  inspectorOpen: false,
```

### Task C.2: Rewrite `hydrateDomReferences` in app.js

- [ ] **Step 2: Replace the `ids` array and function body**

Find `hydrateDomReferences` in `scripts/app.js` and replace entirely with:

```javascript
function hydrateDomReferences() {
  canvasRefs.canvas = document.getElementById("life-canvas");
  canvasRefs.ctx = canvasRefs.canvas.getContext("2d");
  canvasRefs.sparklineCanvas = document.getElementById("sparkline");
  canvasRefs.sparkCtx = canvasRefs.sparklineCanvas.getContext("2d");

  const ids = [
    // Playback pill
    "play-toggle", "step-btn", "back-btn", "speed-chip", "inspector-toggle",
    // Status strip
    "status-dot", "status-rule", "status-gen", "status-pop", "status-pop-token",
    // Sparkline popover
    "sparkline-popover",
    // Popovers
    "speed-popover", "rule-popover",
    // Inspector
    "inspector", "inspector-close", "inspector-backdrop",
    // Scene row
    "fit-btn", "random-btn", "reset-btn", "io-btn", "help-btn",
    // Tools + pattern + rule + theme + advanced
    "tool-grid", "tool-active-label",
    "pattern-card", "pattern-card-preview", "pattern-card-name", "pattern-card-category",
    "ruleset-select", "rule-input",
    "theme-swatches",
    "toggle-buttons", "accent-picker",
    "undo-btn", "redo-btn",
    "history-slider", "history-live-btn", "history-forward-btn",
    // Modals and shared
    "pattern-search", "pattern-category", "pattern-browser-grid",
    "import-text", "export-text", "export-note",
    "import-rle-btn", "import-json-btn", "upload-btn",
    "export-rle-btn", "export-json-btn", "copy-export-btn",
    "file-input", "toast-layer",
  ];
  const toCamel = (id) => id.replace(/-([a-z])/g, (_match, c) => c.toUpperCase());
  ids.forEach((id) => {
    const node = document.getElementById(id);
    if (node) els[toCamel(id)] = node;
  });
}
```

Note: we tolerate missing elements silently here since modal content is conditionally present.

---

## Phase D — UI wiring

**Files:**
- Modify: `game-of-life-v2/scripts/ui.js`
- Modify: `game-of-life-v2/scripts/app.js`

### Task D.1: Rewrite `setupUI` in ui.js for new DOM

- [ ] **Step 1: Replace `setupUI` function**

Find `export function setupUI()` in `scripts/ui.js` and replace the body with:

```javascript
export function setupUI() {
  // Ruleset select (in rule section)
  RULESETS.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.rule;
    option.textContent = `${item.label} · ${item.rule}`;
    els.rulesetSelect.appendChild(option);
  });
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom";
  els.rulesetSelect.appendChild(customOption);

  // Pattern category (pattern modal)
  CATEGORY_OPTIONS.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.patternCategory.appendChild(option);
  });

  // Tool grid — icon-only buttons
  const TOOL_ICONS = {
    freehand: '<svg viewBox="0 0 20 20"><path d="M4 16l3-1 8-8-2-2-8 8-1 3z" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    eraser:   '<svg viewBox="0 0 20 20"><path d="M12 4l4 4-8 8H4v-4l8-8z" stroke-linejoin="round"/><path d="M8 16l-4-4" stroke-linecap="round"/></svg>',
    stamp:    '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="5" height="5" rx="1"/><rect x="11" y="4" width="5" height="5" rx="1"/><rect x="4" y="11" width="5" height="5" rx="1"/><rect x="11" y="11" width="5" height="5" rx="1"/></svg>',
    line:     '<svg viewBox="0 0 20 20"><path d="M4 16L16 4" stroke-linecap="round"/></svg>',
    box:      '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="1"/></svg>',
    circle:   '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6"/></svg>',
  };
  TOOL_ORDER.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tool = tool.id;
    button.setAttribute("aria-label", tool.label);
    button.innerHTML = TOOL_ICONS[tool.id] || tool.label;
    button.addEventListener("click", () => setTool(tool.id));
    els.toolGrid.appendChild(button);
  });

  // Behavior toggles
  [
    { key: "gridLines", label: "Grid" },
    { key: "wrap", label: "Wrap" },
    { key: "particles", label: "Particles" },
    { key: "sound", label: "Sound" },
  ].forEach(({ key, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.toggle = key;
    button.textContent = label;
    button.addEventListener("click", () => {
      state[key] = !state[key];
      if (key === "sound") syncAudioState();
      updateUI();
    });
    els.toggleButtons.appendChild(button);
  });

  // Theme swatches
  THEMES.forEach((theme) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "theme-swatch";
    swatch.dataset.theme = theme.id;
    swatch.setAttribute("aria-label", theme.name);
    swatch.style.background = `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bg2} 60%, ${theme.colors.accent} 100%)`;
    swatch.addEventListener("click", () => {
      setTheme(theme.id);
      updateUI();
      renderPatternBrowser();
    });
    els.themeSwatches.appendChild(swatch);
  });

  // Speed popover options
  SPEED_PRESETS.forEach((preset) => {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "option";
    opt.dataset.value = String(preset.value);
    opt.innerHTML = `<span>${preset.label}</span><span class="meta">${preset.value === "max" ? "—" : preset.value + "/s"}</span>`;
    opt.addEventListener("click", () => {
      state.speed = preset.value;
      closeSpeedPopover();
      updateUI();
    });
    els.speedPopover.appendChild(opt);
  });
  const customRow = document.createElement("div");
  customRow.className = "custom-row";
  customRow.innerHTML = `<input type="range" min="1" max="60" step="1" value="${state.speed}" aria-label="Custom speed">`;
  const rangeInput = customRow.querySelector("input");
  rangeInput.addEventListener("input", () => {
    state.speed = Number(rangeInput.value);
    updateUI();
  });
  els.speedPopover.appendChild(customRow);

  renderPatternBrowser();
  renderPatternCard();
}
```

Also add two new exports at end of ui.js:

```javascript
export function closeSpeedPopover() {
  els.speedPopover.classList.remove("visible");
  els.speedChip.setAttribute("aria-expanded", "false");
}
export function openSpeedPopover() {
  const rect = els.speedChip.getBoundingClientRect();
  els.speedPopover.style.left = `${rect.left + rect.width / 2 - 100}px`;
  els.speedPopover.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  els.speedPopover.classList.add("visible");
  els.speedChip.setAttribute("aria-expanded", "true");
}
export function toggleSpeedPopover() {
  if (els.speedPopover.classList.contains("visible")) closeSpeedPopover();
  else openSpeedPopover();
}

export function openInspector() {
  state.inspectorOpen = true;
  els.inspector.classList.add("open");
  els.inspector.setAttribute("aria-hidden", "false");
  els.inspectorToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("inspector-open");
  const focusTarget = els.inspector.querySelector("button, [tabindex='0']");
  if (focusTarget) focusTarget.focus();
}
export function closeInspector() {
  state.inspectorOpen = false;
  els.inspector.classList.remove("open");
  els.inspector.setAttribute("aria-hidden", "true");
  els.inspectorToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("inspector-open");
}
export function toggleInspector() {
  state.inspectorOpen ? closeInspector() : openInspector();
}

export function renderPatternCard() {
  const pattern = getCurrentPattern();
  els.patternCardName.textContent = pattern.name;
  els.patternCardCategory.textContent = pattern.category;
  drawPatternPreview(els.patternCardPreview, pattern, getTheme().colors.accent);
}

export function showSparklinePopover() {
  els.sparklinePopover.classList.add("visible");
  drawSparkline();
}
export function hideSparklinePopover() {
  els.sparklinePopover.classList.remove("visible");
}
```

And update imports at top of `ui.js` to include `getCurrentPattern` (already imported from `./tools.js`) and `drawPatternPreview` (already imported from `./render.js`).

### Task D.2: Rewrite `updateUI` in ui.js

- [ ] **Step 2: Replace `updateUI` function body**

```javascript
export function updateUI() {
  document.body.classList.toggle("simulating", state.simulating);
  document.body.classList.toggle("rewinding", state.browsingHistory);

  els.playToggle.textContent = state.simulating ? "Pause" : "Play";
  els.statusRule.textContent = getRuleLabel();
  els.statusGen.textContent = state.generation.toLocaleString();
  els.statusPop.textContent = state.liveCells.size.toLocaleString();
  els.speedChip.textContent = state.speed === "max" ? "Max" : `${state.speed}/s`;

  els.stepBtn.disabled = state.simulating;
  els.backBtn.disabled = state.simulationHistory.length <= 1 || state.historyCursor <= 0;
  els.undoBtn.disabled = state.undoStack.length === 0;
  els.redoBtn.disabled = state.redoStack.length === 0;
  els.historyForwardBtn.disabled = state.historyCursor >= state.simulationHistory.length - 1;
  els.historyLiveBtn.disabled = !state.browsingHistory;
  els.historySlider.max = String(Math.max(0, state.simulationHistory.length - 1));
  els.historySlider.value = String(Math.max(0, state.historyCursor));

  // Tools
  const toolLabels = {
    freehand: "Freehand tool active",
    eraser: "Eraser tool active",
    stamp: `Stamping ${getCurrentPattern().name}`,
    line: "Line tool active",
    box: "Box tool active",
    circle: "Circle tool active",
  };
  els.toolActiveLabel.textContent = toolLabels[state.currentTool] || "Tool active";
  Array.from(els.toolGrid.children).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === state.currentTool);
  });

  // Behavior toggles
  Array.from(els.toggleButtons.children).forEach((btn) => {
    btn.classList.toggle("active", state[btn.dataset.toggle]);
  });

  // Theme swatches
  Array.from(els.themeSwatches.children).forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.theme === getTheme().id);
  });

  // Rule controls
  els.rulesetSelect.value = RULESETS.find((r) => r.rule === state.rule) ? state.rule : "custom";
  els.ruleInput.value = state.rule;
  els.accentPicker.value = state.accent;

  // Pattern card
  renderPatternCard();
}
```

### Task D.3: Rewrite `bindEvents` in app.js for new DOM

- [ ] **Step 3: Replace `bindEvents` function**

Find `function bindEvents()` in `scripts/app.js` and replace with:

```javascript
function bindEvents() {
  const { canvas } = canvasRefs;

  window.addEventListener("resize", () => { ensureCanvasSize(); draw(); updateUI(); });
  document.addEventListener("keydown", handleKeydown);

  // Canvas input
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    if (event.shiftKey) {
      event.preventDefault();
      adjustSpeed(event.deltaY < 0 ? 1 : -1);
      updateUI();
      return;
    }
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  canvas.addEventListener("dblclick", (event) => { event.preventDefault(); autoFit(); });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) return;
    canvas.setPointerCapture(event.pointerId);
    if (event.pointerType !== "mouse") return;
    if (event.button === 1) beginInteraction("pan", event.clientX, event.clientY, event.button);
    else if (event.button === 2) beginInteraction("erase", event.clientX, event.clientY, event.button);
    else if (event.button === 0) beginInteraction("paint", event.clientX, event.clientY, event.button);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") updateInteraction(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") endInteraction();
  });
  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "mouse") endInteraction();
  });
  canvas.addEventListener("mouseleave", () => { state.hoverCell = null; });

  // Touch input (unchanged)
  canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      beginInteraction("paint", touch.clientX, touch.clientY, 0);
    } else if (event.touches.length === 2) {
      const [a, b] = event.touches;
      state.interaction = {
        type: "touch-panzoom",
        startCameraX: state.camera.x,
        startCameraY: state.camera.y,
        startZoom: state.camera.zoom,
        startCenterX: (a.clientX + b.clientX) / 2,
        startCenterY: (a.clientY + b.clientY) / 2,
        startDistance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    }
  }, { passive: false });
  canvas.addEventListener("touchmove", (event) => {
    event.preventDefault();
    if (!state.interaction) return;
    if (event.touches.length === 1 && state.interaction.type !== "touch-panzoom") {
      const touch = event.touches[0];
      updateInteraction(touch.clientX, touch.clientY);
    } else if (event.touches.length === 2) {
      const [a, b] = event.touches;
      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = distance / state.interaction.startDistance;
      state.camera.zoom = clamp(state.interaction.startZoom * scale, MIN_ZOOM, MAX_ZOOM);
      const size = 12 * state.camera.zoom;
      state.camera.x = state.interaction.startCameraX - (centerX - state.interaction.startCenterX) / size;
      state.camera.y = state.interaction.startCameraY - (centerY - state.interaction.startCenterY) / size;
    }
  }, { passive: false });
  canvas.addEventListener("touchend", (event) => {
    event.preventDefault();
    if (event.touches.length === 0) endInteraction();
    if (event.touches.length < 2 && state.interaction && state.interaction.type === "touch-panzoom") {
      state.interaction = null;
    }
  }, { passive: false });
  canvas.addEventListener("touchcancel", (event) => {
    event.preventDefault();
    if (event.touches.length === 0) endInteraction();
    if (state.interaction && state.interaction.type === "touch-panzoom") state.interaction = null;
  }, { passive: false });

  // Playback pill
  els.playToggle.addEventListener("click", () => {
    state.simulating = !state.simulating;
    syncAudioState();
    updateUI();
  });
  els.stepBtn.addEventListener("click", () => {
    if (!state.simulating) { stepSimulation(); updateUI(); }
  });
  els.backBtn.addEventListener("click", () => {
    if (state.simulationHistory.length > 1) {
      const nextIndex = Math.max(0, state.historyCursor - 1);
      restoreSnapshot(state.simulationHistory[nextIndex], nextIndex);
      updateUI();
    }
  });
  els.speedChip.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSpeedPopover();
  });
  els.inspectorToggle.addEventListener("click", () => toggleInspector());
  els.inspectorClose.addEventListener("click", () => closeInspector());
  els.inspectorBackdrop.addEventListener("click", () => closeInspector());

  // Status strip
  els.statusRule.addEventListener("click", () => {
    // Open rule popover under the status-rule token
    const rect = els.statusRule.getBoundingClientRect();
    els.rulePopover.innerHTML = "";
    RULESETS.forEach((ruleset) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "option" + (state.rule === ruleset.rule ? " selected" : "");
      opt.innerHTML = `<span>${ruleset.label}</span><span class="meta">${ruleset.rule}</span>`;
      opt.addEventListener("click", () => {
        applyRule(ruleset.rule, true);
        els.rulePopover.classList.remove("visible");
        updateUI();
      });
      els.rulePopover.appendChild(opt);
    });
    const customRow = document.createElement("div");
    customRow.className = "custom-row";
    customRow.innerHTML = `<input type="text" value="${state.rule}" spellcheck="false" placeholder="B/S notation">`;
    const input = customRow.querySelector("input");
    input.addEventListener("change", () => {
      applyRule(input.value, true);
      els.rulePopover.classList.remove("visible");
      updateUI();
    });
    els.rulePopover.appendChild(customRow);
    els.rulePopover.style.left = `${rect.left}px`;
    els.rulePopover.style.top = `${rect.bottom + 8}px`;
    els.rulePopover.classList.add("visible");
  });
  els.statusRule.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.statusRule.click(); }
  });

  // Pop sparkline hover
  let popHoverTimer = null;
  els.statusPopToken.addEventListener("mouseenter", () => {
    popHoverTimer = setTimeout(() => showSparklinePopover(), 120);
  });
  els.statusPopToken.addEventListener("mouseleave", () => {
    if (popHoverTimer) clearTimeout(popHoverTimer);
    setTimeout(() => hideSparklinePopover(), 80);
  });

  // Inspector: Scene row
  els.fitBtn.addEventListener("click", () => autoFit());
  els.randomBtn.addEventListener("click", () => { randomFill(); updateUI(); });
  els.resetBtn.addEventListener("click", () => { resetSimulation(); updateUI(); });
  els.ioBtn.addEventListener("click", () => openModal("io-modal"));
  els.helpBtn.addEventListener("click", () => openModal("help-modal"));

  // Inspector: Pattern card → opens pattern modal
  els.patternCard.addEventListener("click", () => openModal("pattern-modal"));

  // Rule picker (in Advanced)
  els.rulesetSelect.addEventListener("change", () => {
    if (els.rulesetSelect.value === "custom") { els.ruleInput.focus(); return; }
    applyRule(els.rulesetSelect.value, true);
    updateUI();
  });
  els.ruleInput.addEventListener("change", () => {
    applyRule(els.ruleInput.value, true);
    updateUI();
  });

  // Accent picker
  els.accentPicker.addEventListener("input", () => {
    state.accent = els.accentPicker.value;
    state.paletteId = "custom";
    const { r, g, b } = hexToRgb(state.accent);
    document.documentElement.style.setProperty("--accent", state.accent);
    document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    updateUI();
    renderPatternBrowser();
  });

  // Undo / Redo
  els.undoBtn.addEventListener("click", () => { undo(); updateUI(); });
  els.redoBtn.addEventListener("click", () => { redo(); updateUI(); });

  // History slider
  els.historySlider.addEventListener("input", () => {
    const index = Number(els.historySlider.value);
    const snapshot = state.simulationHistory[index];
    if (snapshot) { restoreSnapshot(snapshot, index); updateUI(); }
  });
  els.historyForwardBtn.addEventListener("click", () => {
    if (state.historyCursor < state.simulationHistory.length - 1) {
      const nextIndex = state.historyCursor + 1;
      restoreSnapshot(state.simulationHistory[nextIndex], nextIndex);
      updateUI();
    }
  });
  els.historyLiveBtn.addEventListener("click", () => {
    const nextIndex = state.simulationHistory.length - 1;
    if (nextIndex >= 0) restoreSnapshot(state.simulationHistory[nextIndex], nextIndex);
    updateUI();
  });

  // Pattern modal search/category
  els.patternSearch.addEventListener("input", renderPatternBrowser);
  els.patternCategory.addEventListener("change", renderPatternBrowser);

  // I/O modal
  els.importRleBtn.addEventListener("click", () => {
    try { importRle(els.importText.value); showToast("RLE imported at camera center."); updateUI(); }
    catch (error) { showToast(error.message || "RLE import failed."); }
  });
  els.importJsonBtn.addEventListener("click", () => {
    try { importJson(els.importText.value); showToast("JSON imported."); updateUI(); }
    catch (error) { showToast(error.message || "JSON import failed."); }
  });
  els.uploadBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files[0];
    if (!file) return;
    const text = await file.text();
    els.importText.value = text;
    showToast(`Loaded ${file.name}`);
  });
  els.exportRleBtn.addEventListener("click", () => { els.exportText.value = exportToRle(); });
  els.exportJsonBtn.addEventListener("click", () => { els.exportText.value = exportToJson(); });
  els.copyExportBtn.addEventListener("click", () => {
    if (els.exportText.value) copyText(els.exportText.value);
  });

  // Modal close
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    });
  });

  // Document click: dismiss popovers when clicking outside
  document.addEventListener("click", (event) => {
    if (els.speedPopover.classList.contains("visible")
        && !els.speedPopover.contains(event.target)
        && event.target !== els.speedChip) {
      closeSpeedPopover();
    }
    if (els.rulePopover.classList.contains("visible")
        && !els.rulePopover.contains(event.target)
        && event.target !== els.statusRule) {
      els.rulePopover.classList.remove("visible");
    }
  });
}
```

### Task D.4: Update import list in app.js

- [ ] **Step 4: Ensure app.js imports include the new ui.js exports**

Find the `import ... from "./ui.js"` block in `app.js` and ensure it includes:

```javascript
import {
  setupUI,
  updateUI,
  updatePerformanceCounters,
  renderPatternBrowser,
  showToast,
  copyText,
  openModal,
  closeModal,
  adjustSpeed,
  hexToRgb,
  toggleSpeedPopover,
  closeSpeedPopover,
  openInspector,
  closeInspector,
  toggleInspector,
  showSparklinePopover,
  hideSparklinePopover,
  renderPatternCard,
} from "./ui.js";
```

Also ensure the top of `app.js` imports `applyRule` from `./rules.js` and `RULESETS` from `./constants.js` (needed by rule popover logic in `bindEvents`). Add `RULESETS` to the constants import if missing.

### Task D.5: Remove obsolete imports/functions from ui.js

- [ ] **Step 5: Delete `cycleTheme`, `toggleMode` exports from ui.js**

These are no longer needed — theme cycling is via keyboard (`T`) and inspector swatches. Remove the definitions.

Also remove the `.modal-header .eyebrow` related rendering from `renderPatternBrowser` if present — the new modal markup lacks eyebrows. Search and remove any `els.miniTitle`, `els.miniSubtitle`, `els.miniMeta`, `els.fpsChip`, `els.rateChip`, `els.statsTitle`, `els.rewindLabel`, `els.rewindCount`, `els.sparklineMeta`, `els.controlsPanel`, `els.controlsToggle`, `els.sceneMenu`, `els.modeToggle` references — they no longer exist.

Run a grep in `ui.js`:

```bash
grep -nE "els\.(miniTitle|miniSubtitle|miniMeta|fpsChip|rateChip|statsTitle|rewindLabel|rewindCount|sparklineMeta|controlsPanel|controlsToggle|sceneMenu|modeToggle|generationValue|populationValue|statusText|speedSlider|speedPresets|patternSelect|paletteSelect|toolButtons|browserBtn|copyStateBtn|collapseControls|sceneMenuBtn)" game-of-life-v2/scripts/ui.js
```

Any hit must be removed.

Update `updatePerformanceCounters` to NOT write to removed elements — since fps/rate chips are gone, just remove the `els.fpsChip.textContent = ...` lines.

```javascript
export function updatePerformanceCounters(dt) {
  state.frameCounter += 1;
  state.fpsTimer += dt;
  state.generationRateTimer += dt;
  if (state.fpsTimer >= 0.4) {
    state.fps = state.frameCounter / state.fpsTimer;
    state.frameCounter = 0;
    state.fpsTimer = 0;
  }
  if (state.generationRateTimer >= 0.5) {
    state.generationRate = state.generationRateSteps / state.generationRateTimer;
    state.generationRateSteps = 0;
    state.generationRateTimer = 0;
  }
}
```

### Task D.6: Remove obsolete imports/references in app.js

- [ ] **Step 6: Grep and clean**

```bash
grep -nE "els\.(controlsToggle|sceneMenuBtn|sceneMenu|collapseControls|browserBtn|copyStateBtn|modeToggle|patternSelect|paletteSelect|speedSlider|speedPresets|fpsChip|rateChip|statsTitle|rewindLabel|rewindCount|sparklineMeta|miniTitle|miniSubtitle|miniMeta|controlsPanel|generationValue|populationValue|statusText)" game-of-life-v2/scripts/app.js
```

Any hit must be removed (most are already removed by replacing bindEvents above; this is a sanity check).

Also remove `toggleMode` from imports.

Ensure `app.js` still exposes `window.render_game_to_text`, `window.advanceTime`, `window.__gameOfLifeV2` identically.

### Task D.7: Phase D browser check

- [ ] **Step 7: Run a functional smoke test**

```bash
cd "$TEMP/gol-ui-check" && node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/game-of-life-v2/index.html');
  await p.waitForTimeout(600);
  const dom = await p.evaluate(() => ({
    hasStrip: !!document.querySelector('.status-strip'),
    hasPill: !!document.querySelector('.playback-pill'),
    hasInspector: !!document.querySelector('.inspector'),
    deadToolbar: !document.getElementById('toolbar'),
    deadControls: !document.getElementById('controls-panel'),
    deadStats: !document.getElementById('stats-panel'),
    renderText: typeof window.render_game_to_text,
  }));
  console.log(JSON.stringify(dom, null, 2));
  console.log('errors:', errors.length ? errors : 'none');
  await b.close();
})();
"
```

Expected: all booleans `true`, `renderText === 'function'`, `errors: none`.

---

## Phase E — Input and polish

**Files:**
- Modify: `game-of-life-v2/scripts/input.js`
- Modify: `game-of-life-v2/styles/main.css`

### Task E.1: Add Ctrl+K handler + adjust Esc order

- [ ] **Step 1: Update `handleKeydown` in input.js**

Find `handleKeydown` in `scripts/input.js` and replace the Escape-handling and Ctrl+K branches:

```javascript
import { toggleInspector, closeInspector } from "./ui.js";
```

Add this import near the top. Then inside `handleKeydown`, modify the Escape block:

```javascript
  if (event.key === "Escape") {
    event.preventDefault();
    if (closeTopModal()) return;
    if (state.inspectorOpen) { closeInspector(); return; }
  }
```

(Remove the old references to `els.sceneMenu` / `closeSceneMenu` / `state.showControls`.)

Add Ctrl/Cmd+K above the undo block:

```javascript
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    toggleInspector();
    return;
  }
```

### Task E.2: Add mobile bottom-sheet styles

- [ ] **Step 2: Append mobile rules at the end of `main.css`**

```css
@media (max-width: 768px) {
  .status-strip {
    top: 10px;
    left: 10px;
    right: 10px;
    justify-content: center;
  }
  .playback-pill {
    bottom: 14px;
    padding: 5px;
  }
  .playback-pill .pill-btn {
    min-height: 30px;
    padding: 6px 10px;
    font-size: 12px;
  }
  .inspector {
    top: auto;
    left: 10px;
    right: 10px;
    bottom: 10px;
    width: auto;
    max-height: 74vh;
    transform: translateY(calc(100% + 20px));
    border-radius: 24px 24px 18px 18px;
  }
  .inspector.open {
    transform: translateY(0);
  }
  .inspector::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.2);
  }
  .shortcut-hint { display: none; }
  .sparkline-popover { left: 10px; right: 10px; width: auto; }
}
```

### Task E.3: Verify polish layer

- [ ] **Step 3: Browser check**

```bash
cd "$TEMP/gol-ui-check" && node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:8765/game-of-life-v2/index.html');
  await p.waitForTimeout(500);
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(500);
  const open = await p.evaluate(() => document.getElementById('inspector').classList.contains('open'));
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(500);
  const closed = await p.evaluate(() => !document.getElementById('inspector').classList.contains('open'));
  console.log({ open, closed, errors });
  await b.close();
})();
"
```

Expected: `{ open: true, closed: true, errors: [] }`.

---

## Phase F — Final verification

**Files:**
- Create: `C:\Users\chase\AppData\Local\Temp\gol-ui-check\check-redesign.js`

### Task F.1: Write comprehensive verification script

- [ ] **Step 1: Create `check-redesign.js`**

```javascript
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => errors.push(`request failed: ${req.url()}`));

  await page.goto("http://127.0.0.1:8765/game-of-life-v2/index.html");
  await page.waitForTimeout(700);

  const checks = [];
  const assert = (name, cond) => checks.push({ name, pass: !!cond });

  // 1. No runtime errors
  assert("1. no console / page errors", errors.length === 0);

  // 2. Old DOM is gone
  const deadOld = await page.evaluate(() => ({
    toolbar: !!document.getElementById("toolbar"),
    controls: !!document.getElementById("controls-panel"),
    stats: !!document.getElementById("stats-panel"),
    sceneMenu: !!document.getElementById("scene-menu"),
  }));
  assert("2. old panels removed", !deadOld.toolbar && !deadOld.controls && !deadOld.stats && !deadOld.sceneMenu);

  // 3. New DOM present
  const newDom = await page.evaluate(() => ({
    strip: !!document.querySelector(".status-strip"),
    pill: !!document.querySelector(".playback-pill"),
    insp: !!document.getElementById("inspector"),
  }));
  assert("3. new skeleton present", newDom.strip && newDom.pill && newDom.insp);

  // 4. Screenshot at rest
  await page.screenshot({
    path: "C:/Users/chase/OneDrive/Documents/Studying/python/self_made/grid_evolution/output/gol-v2-redesign-rest.png",
  });
  assert("4. rest screenshot saved", true);

  // 5. Play toggles simulating class
  await page.locator("#play-toggle").click();
  await page.waitForTimeout(200);
  const sim = await page.evaluate(() => document.body.classList.contains("simulating"));
  assert("5. play toggles simulating", sim);
  await page.locator("#play-toggle").click();
  await page.waitForTimeout(150);

  // 6. Inspector opens via gear
  await page.locator("#inspector-toggle").click();
  await page.waitForTimeout(450);
  const opened = await page.evaluate(() => ({
    hasOpen: document.getElementById("inspector").classList.contains("open"),
    ariaHidden: document.getElementById("inspector").getAttribute("aria-hidden"),
  }));
  assert("6. inspector opens (class + aria)", opened.hasOpen && opened.ariaHidden === "false");

  // 7. Ctrl+K toggles inspector
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(450);
  const afterCtrlK = await page.evaluate(() => document.getElementById("inspector").classList.contains("open"));
  assert("7. Ctrl+K closes inspector", !afterCtrlK);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(450);

  // 8. Click theme swatch changes accent
  await page.screenshot({
    path: "C:/Users/chase/OneDrive/Documents/Studying/python/self_made/grid_evolution/output/gol-v2-redesign-inspector-open.png",
  });
  const themeButtons = await page.locator(".theme-swatches .theme-swatch").count();
  assert("8. theme swatches rendered", themeButtons === 4);
  await page.locator(".theme-swatches .theme-swatch").nth(1).click();
  await page.waitForTimeout(200);
  const accentChanged = await page.evaluate(() => document.documentElement.style.getPropertyValue("--accent"));
  assert("9. theme click changes accent var", accentChanged && accentChanged !== "#8d8fff");

  // 10. Pattern card opens modal
  await page.locator("#pattern-card").click();
  await page.waitForTimeout(200);
  const patternModalOpen = await page.evaluate(() => document.getElementById("pattern-modal").classList.contains("open"));
  assert("10. pattern card opens pattern modal", patternModalOpen);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  // 11. Random fill + step back
  await page.keyboard.press("Escape"); // close inspector
  await page.waitForTimeout(150);
  await page.locator("#inspector-toggle").click();
  await page.waitForTimeout(400);
  await page.locator("#random-btn").click();
  await page.waitForTimeout(200);
  const popAfterRandom = await page.evaluate(() => window.__gameOfLifeV2.state.liveCells.size);
  await page.locator("#play-toggle").click();
  await page.waitForTimeout(600);
  await page.locator("#play-toggle").click();
  await page.waitForTimeout(150);
  const genBefore = await page.evaluate(() => window.__gameOfLifeV2.state.generation);
  await page.locator("#back-btn").click();
  await page.waitForTimeout(150);
  const genAfter = await page.evaluate(() => window.__gameOfLifeV2.state.generation);
  assert("11. random fill populates + back steps back", popAfterRandom > 10 && genAfter < genBefore);

  // Running screenshot
  await page.locator("#play-toggle").click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "C:/Users/chase/OneDrive/Documents/Studying/python/self_made/grid_evolution/output/gol-v2-redesign-running.png",
  });

  // Report
  console.log("=== Redesign verification ===");
  checks.forEach((c) => console.log(`${c.pass ? "PASS" : "FAIL"} — ${c.name}`));
  const failed = checks.filter((c) => !c.pass);
  if (errors.length) {
    console.log("\n--- ERROR LOG ---");
    errors.forEach((e) => console.log(e));
  }
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
```

### Task F.2: Run verification

- [ ] **Step 2: Execute check-redesign.js**

```bash
cd "$TEMP/gol-ui-check" && node check-redesign.js
```

Expected: all 11 checks PASS, exit code 0. Three screenshots saved to `output/gol-v2-redesign-{rest,inspector-open,running}.png`.

If any check fails, fix the offending module and rerun. Do not advance to Phase G until all 11 pass.

---

## Phase G — Changelog

**Files:**
- Modify: `progress.md`

### Task G.1: Append redesign notes to progress.md

- [ ] **Step 1: Append a redesign entry**

Add at the bottom of `progress.md`:

```markdown
- UI redesign pass implemented per [docs/superpowers/specs/2026-04-14-ui-redesign-design.md](docs/superpowers/specs/2026-04-14-ui-redesign-design.md):
  - Replaced the toolbar / controls-panel / stats-panel trio with a single status strip (top-left), a floating playback pill (bottom-center), and an on-demand inspector drawer (right, Ctrl+K).
  - Deleted: `.toolbar`, `.controls-panel`, `.stats-panel`, `#scene-menu`, all accordions except Advanced in the inspector, all eyebrow labels, one of the two ambient radial gradients.
  - Reduced panel blur 28px→18px; trimmed shadow intensity ~30%.
  - New popovers: speed (anchored to speed chip), rule (anchored to status rule token), sparkline (hover over Pop token).
  - Theme swatches replaced the theme dropdown.
  - Icon-only tool grid with an active-label caption below.
  - Mobile: inspector becomes a bottom sheet with a drag handle and opens via Ctrl+K or the gear.
  - Added Ctrl+K / Cmd+K shortcut; Esc priority is now modal stack → inspector.
- Verification: all 11 checks in [gol-ui-check/check-redesign.js](C:/Users/chase/AppData/Local/Temp/gol-ui-check/check-redesign.js) pass. Screenshots: [output/gol-v2-redesign-rest.png](output/gol-v2-redesign-rest.png), [output/gol-v2-redesign-inspector-open.png](output/gol-v2-redesign-inspector-open.png), [output/gol-v2-redesign-running.png](output/gol-v2-redesign-running.png).
- Weak spots for future passes: the rule popover and speed popover are inline-built rather than using the `.select-popover` shared component; a general custom-select refactor is still the next structural UI task.
```

---

## Self-review

**1. Spec coverage:** Every spec requirement is mapped to a task:
- Status strip styles/HTML/JS → A.1, B.1, D.2
- Playback pill → A.2, B.1, D.2, D.3
- Inspector drawer → A.3, B.1, D.1, D.2, D.3
- Sparkline popover → A.4, B.1, D.1, D.3
- Speed popover → A.4, D.1 (built in setupUI), D.3 (event wiring)
- Rule popover → A.4, D.3 (inline-built on click)
- Deletions of old DOM → B.1
- Deletions of old CSS → A.5
- State additions → C.1
- Hydration → C.2
- Ctrl+K + Esc order → E.1
- Mobile bottom sheet → E.2
- Test hooks preserved → explicit check in D.6
- Verification → F.1 (11 assertions matching spec)
- Progress update → G.1

**2. Placeholder scan:** No "TBD" / "similar to Task N" / handwavy steps. All code is full; all commands include expected output.

**3. Type consistency:** `toggleSpeedPopover` used in D.3, defined in D.1. `openInspector`/`closeInspector`/`toggleInspector` defined in D.1, used in D.3 (gear click, backdrop click, close button) and E.1 (Ctrl+K). `showSparklinePopover`/`hideSparklinePopover` defined in D.1, used in D.3 (Pop hover). `renderPatternCard` defined in D.1, called from `setupUI` and `updateUI`. DOM IDs consistent between B.1 (markup) and C.2 (hydration). `els.toolGrid` (from `#tool-grid`) used in D.1 and D.2 consistently.

**4. Risk:** Esc order in E.1 drops `state.showControls` — correct, since that state field is no longer used. If a stale `handleKeydown` still references `state.showControls`, E.1 removes it. If a stale `bindEvents` still references removed elements, D.6 grep catches it.

Plan looks clean. Moving to execution.
