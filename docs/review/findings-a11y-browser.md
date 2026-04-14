# Review findings: accessibility + browser compatibility

Date: 2026-04-14
Reviewer: feature-dev:code-reviewer

## Summary

The app has a solid baseline: all interactive elements are real `<button>` elements, `aria-label` is present on most controls, `aria-live` regions cover the status strip and toast layer, and `backdrop-filter` is consistently paired with `-webkit-backdrop-filter`. The main weaknesses are: no focus management in modal/inspector flows (focus does not move in or return), no `prefers-reduced-motion` media query anywhere in the CSS (multiple persistent animations and transitions run unconditionally), and the focus ring is suppressed via `outline: none` with a background-change replacement that fails contrast on glass surfaces. There are 2 Critical, 4 High, and 4 Medium findings; no browser-breaking issues.

---

## Accessibility findings

### Critical — No focus trap and no focus return for modals

- **File(s):** `game-of-life-v2/scripts/ui.js:39-51`, `game-of-life-v2/scripts/app.js:338-345`
- **What:** `openModal()` adds `.open` and sets `aria-hidden="false"` but never moves focus into the modal, never traps Tab inside it, and `closeModal()` never returns focus to the trigger element that opened it.
- **Who it affects:** Keyboard-only users; screen reader users.
- **Evidence:** `openModal` in `ui.js` lines 39-44 — no `el.focus()`, no focusable-child query, no `keydown` Tab interceptor. `closeModal` lines 46-51 — no saved trigger reference, no return focus call.
- **Fix:** On open, query the first focusable child and call `.focus()`; trap Tab/Shift-Tab within the modal's focusable children; on close, call `.focus()` on the stored trigger element.

### Critical — Focus ring completely removed; no visible keyboard indicator on glass surfaces

- **File(s):** `game-of-life-v2/styles/main.css:780-784`
- **What:** The `button:focus-visible` rule sets `outline: none` and substitutes only a background tint (`rgba(255,255,255,0.1)`) and a near-invisible border tint (`rgba(255,255,255,0.16)`) — this does not meet WCAG 2.1 SC 2.4.11 (Focus Appearance) and the background change alone is indistinguishable on the glass/frosted surfaces used for the playback pill, inspector, and modals.
- **Who it affects:** Keyboard-only users.
- **Evidence:**

  ```css
  button:hover, button:focus-visible, … {
    outline: none;
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.16);
  }
  ```

- **Fix:** Remove `outline: none` and add an explicit `outline: 2px solid var(--accent); outline-offset: 2px` inside the `:focus-visible`-only selector (separate it from `:hover`).

### High — No `prefers-reduced-motion` support — persistent animations run unconditionally

- **File(s):** `game-of-life-v2/styles/main.css:61-65, 104, 149, 259-261, 777`
- **What:** The `pulse` keyframe animation on the status dot runs continuously while simulating; the inspector slide-in transition (360 ms cubic-bezier), the playback pill scale transition, and all button transforms have no `prefers-reduced-motion` override.
- **Who it affects:** Motion-sensitive users (vestibular disorders).
- **Evidence:** No `@media (prefers-reduced-motion: reduce)` block exists anywhere in `main.css` (confirmed by search returning zero matches).
- **Fix:** Add a single `@media (prefers-reduced-motion: reduce)` block that removes `animation`, sets `transition-duration: 0.01ms` on all transitions, and disables the JS particle loop by checking `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before enabling `state.particles`.

### High — Toggle buttons (Grid, Wrap, Particles, Sound) missing `aria-pressed`

- **File(s):** `game-of-life-v2/scripts/ui.js:214-230`
- **What:** The four behavior-toggle buttons are stateful on/off controls but are created without `aria-pressed`; only a CSS `.active` class conveys state, which is invisible to screen readers.
- **Who it affects:** Screen reader users.
- **Evidence:** `setupUI` loop at lines 219-229 creates the button and calls `button.textContent = label` but never sets `aria-pressed`. `updateUI` at line 313-315 only calls `btn.classList.toggle("active", ...)` — no `setAttribute("aria-pressed", …)`.
- **Fix:** Set `button.setAttribute("aria-pressed", "false")` in `setupUI` and update it to `String(!!state[key])` inside the `updateUI` loop alongside the `.active` class toggle.

### High — Inspector drawer has no focus management — opens without moving focus

- **File(s):** `game-of-life-v2/scripts/ui.js:92-111`
- **What:** `openInspector()` slides the drawer in and sets `aria-hidden="false"` but never moves focus into the drawer. `closeInspector()` never returns focus to the `inspector-toggle` button. The drawer is `role="dialog"` so screen readers expect focus to land on it or its first focusable child.
- **Who it affects:** Keyboard-only users; screen reader users.
- **Evidence:** `openInspector` lines 92-98 — no `.focus()` call. `closeInspector` lines 100-106 — no focus return.
- **Fix:** At the end of `openInspector`, call `els.inspectorClose.focus()`; at the end of `closeInspector`, call `els.inspectorToggle.focus()`.

### High — `status-rule` span uses `role="button"` instead of being a `<button>`

- **File(s):** `game-of-life-v2/index.html:17`
- **What:** The rule-name trigger is a `<span role="button" tabindex="0">` — it gets Enter/Space handling in `app.js` (line 239-243) but does not receive `:focus-visible` ring styles because the CSS rule covers only `button` elements, not `[role="button"]` elements.
- **Who it affects:** Keyboard-only users (no visible focus ring); screen reader users (no implicit button semantics like disabled state propagation).
- **Evidence:** `index.html:17` — `<span class="rule-name" id="status-rule" role="button" tabindex="0">`. CSS line 780 — the focus-visible rule targets `button:focus-visible` only.
- **Fix:** Replace the `<span>` with a `<button type="button" id="status-rule">` and remove the `role`/`tabindex` attributes; adjust CSS selector if needed.

### Medium — Popovers (speed, rule) are not keyboard-accessible after opening

- **File(s):** `game-of-life-v2/scripts/ui.js:76-88`, `game-of-life-v2/scripts/app.js:201-237`
- **What:** Opening the speed or rule popover does not move focus into it; Tab from the trigger will skip past the popover to the next element in DOM order, leaving keyboard users unable to reach the popover options without mouse.
- **Who it affects:** Keyboard-only users.
- **Evidence:** `openSpeedPopover` (ui.js lines 76-83) and the inline rule popover builder (app.js lines 211-238) — neither calls `.focus()` on the first option after making the popover visible.
- **Fix:** After adding `.visible`, call `.focus()` on the first `.option` child; close the popover and return focus to the trigger on Escape.

### Medium — `aria-haspopup="true"` on speed-chip is wrong value for a menu

- **File(s):** `game-of-life-v2/index.html:36`
- **What:** `aria-haspopup="true"` is a legacy synonym for `"menu"` but the speed popover has `role="menu"` — the correct explicit value is `aria-haspopup="menu"`. The rule-popover trigger (`status-rule` span) has no `aria-haspopup` at all.
- **Who it affects:** Screen reader users (minor announcement difference).
- **Evidence:** `index.html:36` — `aria-haspopup="true"`. The `status-rule` span at line 17 has no `aria-haspopup`.
- **Fix:** Change to `aria-haspopup="menu"` on the speed chip; add `aria-haspopup="menu"` and `aria-expanded="false"` to the `status-rule` element.

### Medium — Sparkline popover is mouse-only; no keyboard or touch trigger

- **File(s):** `game-of-life-v2/scripts/app.js:246-253`
- **What:** The population sparkline popover is shown only on `mouseenter` / hidden on `mouseleave` — there is no `focus`/`blur` equivalent, so keyboard users who Tab to the population token never see the sparkline.
- **Who it affects:** Keyboard-only users.
- **Evidence:** `app.js` lines 247-253 — only `mouseenter`/`mouseleave` listeners on `els.statusPopToken`; no `focusin`/`focusout` listeners.
- **Fix:** Add `focusin` → `showSparklinePopover()` and `focusout` → `hideSparklinePopover()` listeners alongside the existing mouse listeners.

### Medium — `<details>` / `<summary>` Advanced section disclosure icon is a literal `+`/`−` character without `aria-hidden`

- **File(s):** `game-of-life-v2/styles/main.css:573-591`, `game-of-life-v2/index.html:123-146`
- **What:** The `summary::after` pseudo-content is a literal `"+"` or `"−"` character. Some older screen readers may announce the raw character instead of the toggled state.
- **Who it affects:** Screen reader users on older AT.
- **Evidence:** `main.css` lines 594-599. The `summary::after` content is a literal string, not hidden from ATs with `aria-hidden`.
- **Fix:** Wrap the icon in a `<span aria-hidden="true">` inserted via JS, or accept the minor risk given modern AT handles `<details>` natively.

---

## Browser compatibility findings

### Low — `backdrop-filter` — no fallback when unsupported

- **Feature:** CSS `backdrop-filter`
- **File:** `game-of-life-v2/styles/main.css:83-84, 146-147, 248-249, 631-632, 668-669, 856-857`
- **Compatibility:** Supported in Chrome 76+, Firefox 103+, Safari 9+ (with `-webkit-` prefix). All usages are correctly prefixed. Older Chrome 75 / Firefox < 103 silently degrade to an opaque-looking panel.
- **What:** No functional break, but if `backdrop-filter` is unavailable the glass panels lose the blur and may have insufficient contrast.
- **Fix:** Add `@supports not (backdrop-filter: blur(1px))` block that increases background opacity of `.status-strip`, `.playback-pill`, `.inspector`, etc.

### Low — `navigator.clipboard.writeText` requires secure context

- **Feature:** Clipboard API
- **File:** `game-of-life-v2/scripts/ui.js:30`
- **Compatibility:** `navigator.clipboard` is `undefined` on HTTP origins (non-localhost). `copyText` already wraps the call in try/catch with a "Clipboard copy failed" toast.
- **What:** No functional break; mitigated.
- **Fix:** No action required.

### Low — `window.webkitAudioContext` fallback is obsolete

- **Feature:** Web Audio API
- **File:** `game-of-life-v2/scripts/audio.js:6`
- **Compatibility:** `window.AudioContext` is supported in all current browsers. `webkitAudioContext` fallback was needed for Safari < 14.0 (2020). Dead code but harmless.
- **What:** Unreachable fallback branch.
- **Fix:** Optional cleanup — remove the `|| window.webkitAudioContext` branch.

---

## Already good (noted)

- All interactive elements in the playback pill and inspector header are real `<button type="button">` elements.
- `aria-label` is present on all icon-only buttons.
- `aria-expanded` is toggled correctly on the inspector-toggle button and speed-chip.
- `aria-hidden` is toggled correctly on the inspector drawer and modal backdrops.
- `role="status"` + `aria-live="polite"` on the status strip ensures generation and population changes are announced.
- `aria-live="polite"` on the toast layer ensures toast messages are announced.
- `backdrop-filter` is paired with `-webkit-backdrop-filter` on every usage.
- Font stack degrades gracefully: SF Pro → Inter → system-ui → sans-serif.
- `<script type="module">` usage is consistent; AGENTS.md documents the localhost/HTTPS requirement.
- `Map`, `Set`, optional chaining, dynamic `import()`, `performance.now`, `requestAnimationFrame` — all broadly supported.
- Canvas 2D API calls (`setTransform`, `arcTo`, `arc`, `createLinearGradient`) all standard.
- Pointer Events API fully supported in all current browsers including Safari 13.1+.
- Touch event fallback present alongside pointer events.
- CSS `color-scheme`, `:focus-visible`, `min()`, `clamp()`, custom properties — all supported.
- No `:has()`, `color-mix()`, `@container`, or CSS nesting used — no compatibility risk from newer CSS features.
- `<details>`/`<summary>` native semantics used correctly.
- `user-select: none` paired with `-webkit-user-select: none`.
- `.visually-hidden` utility follows correct clip-based pattern.
