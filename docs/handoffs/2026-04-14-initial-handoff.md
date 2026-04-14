# Claude Handoff: Game of Life v2 Refactor + UI Refinement

## Repo

- Root: `c:\Users\chase\OneDrive\Documents\Studying\python\self_made\grid_evolution`
- Main app: `game-of-life-v2/index.html`
- Progress log: `progress.md`

## Primary Goal

Refactor the Game of Life v2 app into a maintainable source structure first, then continue UI/UX refinement.

The app is already feature-complete. The current work is about maintainability first, then continued product-quality UI refinement.

The design target remains an interface that feels:

- elegant
- calm
- premium
- highly intentional
- Apple-like in product quality, but restrained and not derivative

## Why The App Is Currently Single-File

The current single-file `index.html` was not chosen because it was the best long-term tech stack.

It was built that way because the original implementation request explicitly required:

- a single self-contained `index.html`
- embedded CSS + JS
- no external dependencies
- no build tools

That was a spec-compliance choice, not a maintainability choice.

## Updated Direction

Treat the current `game-of-life-v2/index.html` as the working artifact, but move toward a maintainable source layout.

Recommended strategy:

- keep the current app behavior intact
- extract code into logical source files
- keep or regenerate a runnable single-file artifact only if still needed
- prioritize readability, separation of concerns, and safe iteration

## Recommended Refactor Goal

Refactor toward a structure like:

- `game-of-life-v2/index.html`
- `game-of-life-v2/styles/main.css`
- `game-of-life-v2/scripts/app.js`
- `game-of-life-v2/scripts/state.js`
- `game-of-life-v2/scripts/sim.js`
- `game-of-life-v2/scripts/render.js`
- `game-of-life-v2/scripts/input.js`
- `game-of-life-v2/scripts/ui.js`
- `game-of-life-v2/scripts/patterns.js`
- `game-of-life-v2/scripts/history.js`
- `game-of-life-v2/scripts/io.js`
- `game-of-life-v2/scripts/themes.js`

Exact file names can vary, but the split should separate:

- simulation logic
- render logic
- input handling
- UI wiring
- pattern data
- import/export
- history/undo/rewind
- theme and design tokens

## Refactor Rules

During refactor:

- preserve all current behavior
- do not intentionally redesign functionality
- avoid mixing refactor and major feature changes in the same pass
- keep the app runnable after each meaningful checkpoint
- prefer small, coherent extraction passes

If needed, do the refactor in two layers:

1. modularize source code into maintainable files
2. later decide whether to keep a bundled single-file build artifact

## Current Product State

The app already supports:

- sparse infinite grid simulation using `Map<string, number>`
- full-viewport canvas
- infinite pan and zoom
- v1 parity features and keyboard shortcuts
- 13 patterns
- painting and erasing
- pattern ghost preview
- speed control
- grid lines
- wrapping
- help overlay
- drawing tools
- undo/redo
- rulesets
- population sparkline
- generation rewind
- pattern library
- RLE import/export
- light/dark and additional themes
- touch support
- `requestAnimationFrame` + accumulator timing

## Design Direction

Aim for a product quality bar closer to:

- Apple HIG-quality control surfaces
- Linear-style clarity and hierarchy
- Arc-like calm, polished interaction design

Avoid:

- generic dashboard UI
- noisy glassmorphism
- flashy gradients for their own sake
- “wall of pills” control layouts
- AI-slop styling

Every visible element should justify its existence.

## What Was Already Improved

The UI has already been significantly redesigned from the earlier bulky state.

Completed improvements:

- consolidated the top toolbar into a more compact transport/control surface
- removed the separate bottom-center setup panel
- moved low-frequency scene actions into an overflow menu
- converted the right dock into accordion-style sections using `details`
- compressed the stats area into a quieter monitor tray
- softened glass, border, and shadow treatment
- tightened spacing, copy, and hierarchy
- fixed native dropdown white-on-white contrast issues

## Current Highest-Value Next Step

Refactor the codebase structure before continuing the custom select / popover polish pass.

The custom select work is still a strong next UI improvement, but it should happen after the code is easier to work in.

## Recommended Refactor Order

### 1. Inspect current `game-of-life-v2/index.html`

Identify clean extraction boundaries before moving code.

### 2. Create a maintainable source layout

Start by extracting:

- CSS into `styles/main.css`
- pattern data into a dedicated script
- simulation/state/history into dedicated scripts
- rendering into a dedicated script
- input and UI wiring into dedicated scripts

### 3. Reconnect the app without changing behavior

Use plain script tags and no framework unless there is a very strong reason otherwise.

### 4. Verify parity after refactor

Do a focused parity check before resuming visual polish.

### 5. Resume the custom select / popover pass

Only after the refactor is stable.
This UI pass is already partially started in the current codebase and should be resumed after refactor stabilization.

### What is already done

CSS has already been added for the new custom control system, including classes like:

- `.native-select-hidden`
- `.select-proxy`
- `.select-popover`
- `.select-option`

### What is not done yet

The DOM and JavaScript wiring for the custom select system is still incomplete.

## Refactor Notes

The UI has already been heavily reorganized, so extract carefully rather than rewriting from scratch.

Good extraction boundaries likely already exist around:

- state/config
- simulation stepping
- camera/rendering
- pointer/touch/keyboard input
- toolbar and panel UI
- modal/import/export flows
- themes and tokens
- pattern definitions

Avoid changing behavior while extracting.

## Deferred UI Pass: Custom Select Replacement

After refactor, resume the custom select replacement.

Recommended approach:

- keep the real native `<select>` elements in the DOM for application state
- visually hide them with `.native-select-hidden`
- render a custom proxy button for each select
- open a shared popover menu when the proxy is clicked
- update the proxy label when the underlying select changes

Suggested shared popover id:

- `select-popover`

Likely helper functions:

- `upgradeSelect(select)`
- `syncSelectProxyLabel(select)`
- `openSelectPopover(select, proxyButton)`
- `closeSelectPopover()`

Likely first targets:

- ruleset select
- theme select
- pattern select
- palette select
- pattern category select if it still benefits from the custom control treatment

## UI Areas Still Worth Improving After Refactor

After the refactor and custom select pass, likely next targets are:

- reduce the remaining “form” feeling in the right dock
- make the toolbar feel even less like a row of pills
- improve control tiering so primary and secondary actions feel distinct
- make mobile feel more like a true sheet-based interface instead of compressed desktop chrome
- refine motion and transitions with more restraint and better timing

## Verification Requirements

Do real browser testing after each meaningful pass.

Do not stop at static code edits.

Verify at minimum:

- refactor parity
- toolbar actions
- studio panel interactions
- custom control behavior
- overflow menu behavior
- modals
- random fill
- play/pause
- rewind
- console errors
- responsive/mobile layout if touched

## Local Run URL

- `http://127.0.0.1:8765/game-of-life-v2/index.html`

## Local Server

From repo root:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

## Existing Screenshot Artifacts

These previous screenshots are useful for seeing the current redesign direction:

- `output/gol-v2-loop-major.png`
- `output/gol-v2-loop-refined.png`
- `output/gol-v2-loop-interaction.png`

There are also earlier verification screenshots in `output/`.

## Known Verification Setup

Playwright was previously run from a temp directory:

- `%TEMP%\gol-ui-check`

That workflow was used to:

- load the local app URL
- click and interact with controls
- save screenshots into `output/`
- inspect console state
- optionally print `window.render_game_to_text()`

If that temp setup still exists, reuse it. Otherwise recreate it.

Basic setup if needed:

```powershell
mkdir $env:TEMP\gol-ui-check -Force
cd $env:TEMP\gol-ui-check
npm init -y
npm install playwright@1.59.1
npx playwright install chromium
```

## Research Expectations

Before substantial UI changes, look up current best practices and strong references.

Prefer high-signal sources such as:

- Apple Human Interface Guidelines
- well-regarded product design systems
- strong control-surface and popover patterns
- mobile bottom-sheet guidance
- typography and spacing rhythm guidance
- motion guidelines emphasizing restraint

Use the research to justify decisions around:

- visual hierarchy
- toolbar density
- popovers/listboxes
- glassmorphism restraint
- motion and transition timing
- mobile sheets

## Working Style

Be proactive and execute, not just analyze.

Recommended loop:

1. inspect current app structure and current browser behavior
2. identify the next clean extraction boundary
3. research best practices if making substantial architecture or UI decisions
4. implement one coherent refactor or UI pass
5. verify in browser with screenshots
6. check console
7. update `progress.md`
8. repeat

## Update `progress.md`

After each meaningful pass, append:

- what changed
- what was verified
- what still feels weak
- what research influenced the decisions

## Short Immediate Task List

If you want the shortest possible starting sequence, do this:

1. inspect `game-of-life-v2/index.html`
2. split the app into maintainable source files without changing behavior
3. verify parity in browser
4. resume the custom select / popover system
5. save new screenshots to `output/`
6. update `progress.md`

## Final Deliverable For This Session

By the end of the session, aim to leave:

- a maintainable project structure
- a materially more elegant UI than the current version
- no regressions in core interactions
- updated `progress.md`
- notes on what was verified
- a short summary of remaining weak spots
