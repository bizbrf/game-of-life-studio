# Code Review — Game of Life v2

**Date:** 2026-04-14
**Scope:** 15 ES modules + `index.html` + `styles/main.css` in `game-of-life-v2/`
**Depth:** Deep review across four themes — bugs, architecture, performance, accessibility + browser compat
**Method:** Four parallel `feature-dev:code-reviewer` agents, each themed, consolidated here

Full per-theme findings:

- [findings-bugs.md](findings-bugs.md) — 5 findings
- [findings-architecture.md](findings-architecture.md) — 11 findings
- [findings-performance.md](findings-performance.md) — 8 findings
- [findings-a11y-browser.md](findings-a11y-browser.md) — 13 findings

Totals: 37 findings (6 Critical, 14 High, 12 Medium, 5 Low). After cross-theme deduplication: 34 distinct issues.

## Executive summary

The refactor to 15 modules is **structurally sound and well-executed**. The simulation core, coordinate math, history, and I/O paths are all correct. The app's correctness baseline is high.

The review surfaced three broad patterns worth naming up front:

1. **The documented "one known wart" (`rules.js → ui.js`) is actually five instances.** `history.js`, `sim.js`, `tools.js`, and `input.js` all import from `ui.js` — mostly for `showToast` / `updateUI`. None is documented. `module-map.md` row for `input.js` lists 3 imports when the real count is 9. This is the single biggest architectural finding and overlaps with bugs, architecture, and performance themes.

2. **Middle-layer modules touch `document`/`window` contrary to Invariant 3.** `themes.js`, `render.js` (`getComputedStyle` per frame), and `audio.js` all reach for the DOM or `window` despite AGENTS.md rules stating sim/render/history/io must not. This creates both architectural leakage and a real performance cost (per-frame style system hits in `render.js`).

3. **Accessibility is on the right track but not finished.** The hard parts are done (real `<button>`s, aria-live regions, proper `<details>`). The easy parts are missing: focus trap/return on modals, visible focus ring, `prefers-reduced-motion`, `aria-pressed` on toggle buttons. All fixable in a single pass.

**There is one real crash** (`endInteraction` TypeError on pinch-zoom with geometry tool active) and **two real rendering correctness bugs** (sparkline fill polygon, sparkline canvas zero-size transform reset). All are High severity but narrow scope.

## Top 10 findings (cross-theme, prioritised)

| # | Severity | Theme | File:line | Summary |
|---|---|---|---|---|
| 1 | Critical | Arch | state.js:5 ↔ rules.js:4 | Circular import between `state.js` and `rules.js` |
| 2 | Critical | Arch + Bugs | history.js:6, sim.js:15, tools.js:6, input.js:20 | 4 undocumented upward imports to `ui.js`; module map wrong |
| 3 | Critical | Perf | render.js:55-68 | Per-cell `save`/`restore` + state writes (~11k canvas ops/frame at 1k cells) |
| 4 | Critical | Perf | render.js:73 | New `LinearGradient` allocated every frame for background |
| 5 | Critical | A11y | ui.js:39-51 | No focus trap or focus return on modals |
| 6 | Critical | A11y | main.css:780-784 | Focus ring removed via `outline: none`; no visible keyboard indicator |
| 7 | High | Bugs | input.js:83-88 | Crash when pinch-zoom ends with geometry tool active |
| 8 | High | Arch + Perf | render.js:97, 163 | `getComputedStyle(document)` called every frame in draw path |
| 9 | High | Arch | themes.js:39, 55 | `themes.js` writes to `document.documentElement.style` |
| 10 | High | Perf | app.js:405, ui.js:328 | `updateUI()` unconditional every frame, redraws pattern preview canvas each frame |

## Cross-cutting themes

### Theme A — The known-wart leak

ADR-0003 and ARCHITECTURE.md both say "`rules.js → ui.js` is the one and only known exception." The code has five instances, and the module map doesn't list any of them. This means:

- Agents reading the docs will be misled about the real dependency graph.
- New agents may propagate the pattern, citing precedent.
- `render.js → tools.js → ui.js` creates an implicit chain putting render one hop from UI.
- `tools.setTool` / `tools.selectPattern` call `updateUI` internally, causing full UI repaints from non-UI contexts.

**Correct path forward:** Refactor middle-layer modules to return results (error strings, success flags) and let callers (`app.js` / `ui.js`) decide how to surface them. Same fix as ADR-0003 already recommended for `rules.js`. Update `module-map.md` to accurately reflect imports.

### Theme B — Middle-layer DOM access

Three separate findings all point to the same problem: the documented rule ("DOM access lives in `app.js` and `ui.js`") is not enforced.

- `themes.js` writes 15 CSS custom properties to `document.documentElement.style`
- `render.js` reads `window.devicePixelRatio` and does `getComputedStyle(document)` every frame
- `audio.js` reads `window.AudioContext`

The `render.js` case is both an architectural and a performance issue — `getComputedStyle` can force a layout recalc, and it happens in the per-frame draw path.

**Correct path forward:** Move DOM writes in `themes.js` to a `ui.js` projection function. Cache resolved CSS values in `state` when theme changes, read from state in `render.js`. Either accept `audio.js`'s `window.AudioContext` as "Web platform API, not DOM" and carve it out explicitly in ARCHITECTURE.md, or wrap it in `app.js` adapter.

### Theme C — RAF loop does too much every frame

Three performance findings combine: `updateUI()` is called every frame; inside `updateUI()`, `renderPatternCard()` redraws a canvas every frame; `drawRoundedRect` does a save/restore + full state write per cell. Plus `getComputedStyle` and `generateCustomPalette` per frame (when custom palette is active).

Net effect: at 60fps with 1000 cells, ~660,000 canvas state operations per second plus thousands of per-frame allocations.

**Correct path forward:** Introduce a `uiDirty` flag set by state mutations; skip `updateUI` when clean. Batch `drawCells` by colour bucket; eliminate the per-cell `save`/`restore`. Cache gradient, computed styles, and custom palettes on their real update events.

### Theme D — Accessibility polish gap

The app does the hard parts (real `<button>`s, aria-live, proper semantics) but misses the easy ones:

- No focus trap / return on any modal
- Focus ring suppressed without accessible replacement
- No `prefers-reduced-motion` coverage
- Toggle buttons missing `aria-pressed`
- `status-rule` is a `<span role="button">` that misses the focus-visible CSS

**Correct path forward:** Single "a11y polish pass" — can ship as one PR. Every item has a clear, small fix; no architectural change required.

## Proposed issue batches

Rather than filing 34 individual issues, group related findings into issue batches. Each batch becomes one issue with the full finding set as the body; fixable as one PR.

### Batch 1 — Fix the known-wart leak + document reality

- Critical: state.js ↔ rules.js cycle (arch-1)
- Critical: 4 undocumented ui.js imports (arch-2, bugs-5)
- Medium: input.js imports too much from ui.js (arch-6)
- Medium: tools.js hand-assembles cell key (arch-8)
- Low: cycleTheme missing from module-map (arch-9)
- Low: input.js imports row in module-map wrong (arch-10)
- Documentation accuracy section from arch findings

**One issue, one PR.** Removes the cycle, hoists toasts to `app.js`/`ui.js`, updates docs to match reality, amends ADR-0003.

### Batch 2 — Fix real bugs (crashes + visual corruption)

- High: endInteraction pinch-zoom crash (bugs-1)
- High: sparkline fill polygon (bugs-2)
- Medium: sparkline canvas zero-size guard (bugs-3)
- Medium: freehand undo-entry-per-cell (bugs-4)

**One issue, one PR.** Targeted bug fixes with no architectural implications.

### Batch 3 — Performance: hot-path allocations + per-frame style reads

- Critical: drawRoundedRect per-cell save/restore (perf-1)
- Critical: LinearGradient allocated per frame (perf-2)
- High: updateUI called unconditionally every frame + renderPatternCard canvas redraw (perf-3)
- High: getComputedStyle in draw path (perf-4) — also arch-5
- High: Math.max spread over sparkline values (perf-5)
- Medium: getPaletteColors recomputing custom palette every frame (perf-7)
- Medium: drawParticles per-particle string allocation (perf-8)

**One issue, possibly two PRs.** First PR: caching (gradient, computed styles, palette, particle styles). Second PR: the bigger batching refactor (`drawRoundedRect` → bucketed `drawCells`, `uiDirty` flag).

### Batch 4 — Middle-layer DOM access

- High: themes.js → document.documentElement (arch-4)
- High: render.js → window + getComputedStyle (arch-5) — overlaps perf-4
- Medium: audio.js → window.AudioContext (arch-7)
- Medium: sim.js imports visibleWorldBounds from render.js (arch-3)

**One issue, one PR.** Moves DOM projections to `ui.js`/`app.js`; extracts `visibleWorldBounds` to a pure helper.

### Batch 5 — Accessibility polish pass

- Critical: no focus trap/return on modals (a11y-1)
- Critical: focus ring removed (a11y-2)
- High: no prefers-reduced-motion (a11y-3)
- High: toggle buttons missing aria-pressed (a11y-4)
- High: inspector drawer no focus management (a11y-5)
- High: status-rule span should be button (a11y-6)
- Medium: popovers not keyboard-reachable (a11y-7)
- Medium: aria-haspopup="true" should be "menu" (a11y-8)
- Medium: sparkline popover is mouse-only (a11y-9)

**One issue, one PR.** Clean sweep; each fix is small.

### Batch 6 — Low-severity cleanup

- Medium: `<details>` icon not aria-hidden (a11y-10)
- Low: backdrop-filter fallback (browser-1)
- Low: webkitAudioContext dead code (browser-3)
- "Already efficient / already good" items from all four reports — not action items, but worth preserving

**One issue, optional PR.** Low-priority polish; can be done or skipped.

### Integer-key migration (deferred, not batched)

- High (but deferred): computeNeighborCountMap string allocations (perf-6)

This is the one finding ADR-0001 already explicitly defers. At current populations, not visible. If users start running 10k+ cell simulations, this becomes the bottleneck. Keep as a future ADR-0004 if/when needed.

## Out-of-scope observations

Things the agents flagged as "not a concern" are worth a scan — they confirm what's working:

- Sim loop structure is correct (no redundant map lookups, correct iteration order).
- `updateFadeAnimations` map mutation during iteration is safe per spec.
- `pushPopulation` 200-element shift is negligible (not a hot cost despite being O(N)).
- Canvas 2D API usage is standard; no spotty-support calls.
- ES module loading, pointer events, and touch fallback are all correct.
- The `input.js` dynamic `import("./tools.js")` is an intentional load-order workaround, not a real cycle.
- Font stack degrades gracefully outside Apple devices.

## What the review did not cover

- **Security** — the app has no authentication, no network calls, no persistence. The attack surface is RLE/JSON import, which already rejects malformed input. Not a substantive concern; excluded from scope.
- **Build / CI** — there is no build; this is by design (ADR-0002).
- **Tests** — there are no tests. Headless Playwright smoke tests exist in concept (`window.render_game_to_text`, `window.advanceTime`) but no test files. A test-harness design would be its own brainstorm cycle.
- **Mobile-specific layout issues** beyond touch-target sizing — the review didn't simulate actual small-viewport layouts.

## Recommended order of operations

1. **Batch 2 (bugs)** — the crash is user-visible and fixable in <30 lines.
2. **Batch 1 (known-wart + doc reality)** — unblocks future architectural work.
3. **Batch 5 (a11y polish)** — small, uniform, good portfolio signal.
4. **Batch 3 (performance)** — biggest codebase impact; split into the cache PR (low risk) and the batching PR (medium risk).
5. **Batch 4 (middle-layer DOM)** — depends on Batch 1 being done first.
6. **Batch 6 (cleanup)** — whenever.

After Batches 1–3, cut **v0.1.0** with a real CHANGELOG entry. The bugs are fixed, the architecture matches its docs, and the performance is real. Good shipping point.

## How to use this review

The parent agent (me) can file each batch as a GitHub issue using the existing templates. Each issue body will include:

- The findings that comprise the batch
- File:line evidence
- Proposed fix summary
- Severity

Want me to proceed with filing all 6 batch issues, or pick specific ones?
