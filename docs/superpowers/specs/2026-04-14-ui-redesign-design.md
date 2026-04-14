# Game of Life v2 — UI Redesign (B+A Hybrid)

**Status**: approved for implementation
**Date**: 2026-04-14
**Scope**: `game-of-life-v2/` only

## Goal

Replace the current three-panel "control deck" UI with a single floating playback pill + persistent status strip + on-demand inspector drawer. Target aesthetic: Apple macOS apps (Notes / Pages) meets OpenAI / Arc minimalism. Canvas dominates; chrome recedes.

## Why

The current UI is feature-complete but dense. Three simultaneous floating panels (toolbar, right dock, bottom-left stats) compete for attention. Accordions in the right dock create a "form" feel that contradicts the [IMPLEMENTATION-SPEC.md](../../../game-of-life-v2/IMPLEMENTATION-SPEC.md) aesthetic charter. The user wants a consolidated, elegant, Apple-like control surface that lets the simulation breathe.

## Non-goals

- Do **not** rewrite the simulation core, input handling, or rendering math. All existing behavior preserved.
- Do **not** add new simulation features. Visual/interaction redesign only.
- Do **not** remove any feature — every current control gets a new home.
- Do **not** touch `patterns.js`, `sim.js`, `history.js`, `rules.js`, `io.js`, `audio.js`, `utils.js`, `constants.js`. These are pure-logic modules; the redesign is surface-only.
- Do **not** migrate away from ES modules or change the build (still no bundler).

## Target layout (at rest)

```
┌──────────────────────────────────────────────────────┐
│ ● Conway · Gen 142 · Pop 1,284                       │  status strip
│                                                      │  (top-left, 12px from edge)
│                                                      │
│              [ canvas · full bleed ]                 │
│                                                      │
│                                                      │
│              ┌─────────────────────────┐             │
│              │ ▶  ⇤  ⇥  │ 15/s │  ⚙  │             │  playback pill
│              └─────────────────────────┘             │  (bottom-center, 20px from edge)
│                                               ⌘K    │  shortcut hint
└──────────────────────────────────────────────────────┘
```

On gear click or `Ctrl/Cmd+K`:

```
                                        ┌──────────────┐
                                        │  Inspector ✕│
                                        │              │
                                        │  Scene       │
                                        │  [Fit][Rnd]  │
                                        │  [Reset][IO] │
                                        │              │
                                        │  Tools       │
                                        │  ◇◇◇◇◇◇     │
                                        │              │
                                        │  Pattern     │
                                        │  [card]      │
                                        │              │
                                        │  Rule        │
                                        │  Theme       │
                                        │              │
                                        │  Advanced ▸  │
                                        └──────────────┘
```

Drawer width: 320px, slides in from right over canvas. Canvas stays interactive behind it.

## Component specs

### Status strip

- **Container**: fixed top:12px left:12px; glass pill; ~14px vertical padding
- **Content** (single line, monospace digits):
  - Live dot (9×9): green + pulse when running, neutral when paused, amber when `state.browsingHistory === true`
  - Rule name (`Conway`, `HighLife`, or `Custom`) — clickable, opens rule picker inline below strip
  - Middle-dot separator
  - `Gen ` + `state.generation.toLocaleString()` with `font-variant-numeric: tabular-nums`
  - Middle-dot separator
  - `Pop ` + `state.liveCells.size.toLocaleString()` — hovering this token reveals a sparkline popover (200 gens) below strip
- **Typography**: `font-size: 12px`, `font-weight: 500`, `letter-spacing: 0.005em`
- **Interaction**: pointer-events-auto; does not intercept canvas clicks

### Playback pill

- **Container**: fixed bottom:20px left:50%; transform:translateX(-50%); glass pill; min-width:260px; 8px padding
- **Content** (left → right):
  - `▶/Ⅱ` button — primary accent, 32px diameter circle inside pill, slightly larger than neighbors. Uses `state.simulating` to swap label.
  - `⇤` step-back — ghost button; disabled when no history
  - `⇥` step — ghost button; disabled when `state.simulating`
  - Thin 1px vertical divider (10px tall, `rgba(255,255,255,0.1)`)
  - Speed chip: label reads `15/s` or `Max`. Clicking opens popover above pill with 5 preset buttons (Slow/Normal/Fast/Turbo/Max) + slider for custom value.
  - Thin divider
  - `⚙` gear button — toggles inspector drawer. `aria-expanded` reflects state.
- **Shortcut hint**: tiny `⌘K` kbd-styled label at bottom-right corner of viewport, `rgba(*, 0.35)`. Label only — not a button. Indicates the inspector toggle shortcut.

### Inspector drawer

- **Container**: fixed top:12px right:12px bottom:12px; width:320px; glass; border-radius:20px; padding:20px 20px 24px
- **Transform**: `translateX(110%)` when closed; `translateX(0)` when open. Transition: `transform 360ms cubic-bezier(0.25, 0.85, 0.4, 1)` (spring-like)
- **Header row**: title "Inspector" (14px / 600) + close ✕ icon button
- **Sections** (single scroll column, 18px gap between sections):
  1. **Scene** — row of 5 equal-width ghost buttons: Fit · Random · Reset · I/O · Help. Icons + labels. "Help" opens the existing `#help-modal`. "I/O" opens `#io-modal`.
  2. **Tools** — `.segmented` 6-column grid of icon-only buttons (SVG inline icons: pencil, eraser, stamp, line-diagonal, square, circle). Active tool gets accent background. Active tool's label appears below the segmented control in a single row: "Line tool active."
  3. **Pattern** — one full-width card: left side 80×56px canvas preview of current pattern; right side pattern name (14px/600) + category (11px/dim). Clicking opens existing pattern modal.
  4. **Rule** — compact select button (reuses `.select-proxy` CSS already present). Clicking opens popover with RULESETS list + `Custom…` option that reveals `rule-input`.
  5. **Theme** — row of 4 swatches (each 56×40px with rounded corners). Each swatch is a mini gradient using that theme's `bg` → `accent` colors. Active theme gets 2px accent border + checkmark overlay.
  6. **Advanced** `<details>` (collapsed by default) containing:
     - Toggles grid (Grid / Wrap / Particles / Sound) — same rendering as today, but compacted
     - Accent color picker (small circular swatch + color input)
     - Undo / Redo buttons (ghost, with disabled state)
- **Focus management**: on open, focus first focusable element in drawer. `Esc` closes. Click on the dimmed backdrop overlay behind the drawer closes. While open, `aria-hidden="false"`; while closed, `aria-hidden="true"`.

### Sparkline popover (hover over Pop)

- Appears below status strip when cursor hovers the Pop count token for ≥120ms
- Width: 200px; height: 48px
- Renders `state.populationHistory` using the existing `drawSparkline` logic
- Dismisses on `mouseleave` with 80ms delay (grace period)

## Deletions

From the current DOM:

- `#toolbar` (the top-left panel) — replaced by status strip
- `#controls-panel` (the right dock) — replaced by inspector drawer
- `#stats-panel` (the bottom-left panel) — merged into status strip + inspector sparkline
- `#scene-menu` overflow popover — items move into inspector's Scene row
- All `.accordion-summary` / `<details>` power-user patterns except **Advanced** in the inspector
- All `.eyebrow` uppercase labels throughout — they added visual tax without information

## What stays unchanged (DOM)

- `#life-canvas`
- `#sparkline` (moved under inspector)
- `#help-modal`, `#pattern-modal`, `#io-modal` — modal content unchanged; open/close behavior unchanged
- `#toast-layer`, `#file-input` — behavior unchanged

## JS module changes

- **ui.js** — major rewrite of `setupUI` and `updateUI`; new functions `openInspector`, `closeInspector`, `toggleInspector`, `openSpeedPopover`, `openRulePopover`, `openSparklinePopover`
- **app.js** — `hydrateDomReferences` updated for new element IDs; `bindEvents` rewired to new DOM
- **input.js** — add `Ctrl/Cmd+K` handler for inspector toggle; `Esc` closes inspector before modal stack
- **state.js** — add `state.inspectorOpen: boolean` (default false on desktop, always false on mobile); add `els` entries for new elements
- **render.js** — no functional change (existing sparkline drawing is reused)
- **index.html** — full DOM replacement for panels; modals kept as-is
- **styles/main.css** — tokens kept; layout rules rewritten for new panels; remove accordion-specific styles except `Advanced`; add `.status-strip`, `.playback-pill`, `.inspector`, `.theme-swatch`, `.sparkline-popover`; reduce panel blur 28→18px; reduce shadow intensity ~30%

## Motion

- **Inspector slide**: `transform 360ms cubic-bezier(0.25, 0.85, 0.4, 1)` + opacity
- **Playback pill**: hover `scale(1.02)`; active `scale(0.98)`; both 140ms ease
- **Status dot pulse**: existing animation, unchanged
- **Status strip**: no hover motion; this is ambient information, not a control
- **Theme swatches**: 180ms ease on active border

## Mobile (viewport < 768px)

- Status strip: stays top, 12px from edges; no change
- Playback pill: stays bottom-center
- Inspector: becomes bottom sheet — slides up from below, fills bottom 70vh, drag handle on top
- Help modal / pattern modal / IO modal: unchanged from current responsive behavior

## Keyboard

All existing shortcuts preserved. Additions:

- `Ctrl+K` / `Cmd+K`: toggle inspector drawer
- `Esc` order: scene-menu (dead) → inspector → modal stack → (controls toggle is dead)

## Accessibility

- Inspector drawer: `role="dialog"` `aria-modal="false"` `aria-label="Inspector"` `aria-hidden` toggled
- Status strip: plain text, not interactive regions; hover popovers use `role="tooltip"`
- All buttons have `aria-label` or visible text
- Color contrast: minimum 4.5:1 for text; all four themes verified

## Test hooks preserved

- `window.render_game_to_text` — return shape unchanged
- `window.advanceTime(ms)` — unchanged
- `window.__gameOfLifeV2.state` / `.exportToJson` / `.exportToRle` — unchanged

## Verification plan

Headless Chromium (Playwright, reusing `%TEMP%/gol-ui-check` setup):

1. Load `http://127.0.0.1:8765/game-of-life-v2/index.html`
2. Assert: no console errors; no pageerror; no failed module requests
3. Assert: `#controls-panel`, `#toolbar`, `#stats-panel` do **not** exist in DOM
4. Assert: `.status-strip`, `.playback-pill`, `.inspector` exist
5. Click play → assert `document.body.classList.contains('simulating')`
6. Click gear → assert inspector has `.open` class and `aria-hidden="false"`
7. Press `Ctrl+K` (twice) → assert inspector toggles
8. Click a theme swatch → assert `document.documentElement.style` has new `--accent`
9. Click pattern card → assert pattern modal opens
10. Random fill → play → assert population changes; step back → assert generation decreases
11. Save screenshots to `output/gol-v2-redesign-{rest,inspector-open,running}.png`

All 11 checks must pass before the phase is marked complete.

## Risk register

- **Risk**: moving stats into status strip changes how often `updateUI` has to run per frame. Current implementation runs every RAF; not a regression.
- **Risk**: inspector backdrop could steal canvas clicks. Mitigation: backdrop only covers area under inspector, not full viewport; `pointer-events: none` on a full-screen dim layer with pointer-events-auto only on the drawer.
- **Risk**: theme swatch rendering against existing theme colors may produce low-contrast swatches for the Ivory (light) theme on a dark drawer. Mitigation: swatches include a subtle border that lifts them regardless of theme.
- **Risk**: removing accordions means losing the visual "power user density" that some may like. Mitigation: the Advanced `<details>` in inspector preserves progressive disclosure for the one section where it earns its keep.

## Out of scope for this pass

- Custom select/popover component for all dropdowns (ruleset, pattern index, palette). A minimal version is built inline for the Speed popover and Rule popover; a general component refactor is a follow-up.
- Sound design expansion
- Additional themes beyond the current four
- A keyboard command palette beyond Ctrl+K for inspector
- Figma-level canvas toolbar with undo/redo visible at rest — these stay in Advanced

## Success criteria

- All 11 verification checks pass
- Visual screenshots show: fullscreen canvas, single status strip, single playback pill, inspector closed at rest
- `progress.md` updated with new screenshots and a "what feels weak" note for future passes
- No increase in console errors or failed network requests vs. current build
