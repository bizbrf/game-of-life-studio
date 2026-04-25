// UI orchestration: status strip, playback pill, inspector drawer, popovers, modals.

import {
  RULESETS,
  THEMES,
  SPEED_PRESETS,
  TOOL_ORDER,
} from "./constants.js";
import { PATTERNS, CATEGORY_OPTIONS } from "./patterns.js";
import { state, els } from "./state.js";
import { capitalize, clamp, hexToRgb } from "./utils.js";
import { getTheme, setTheme } from "./themes.js";
import { getRuleLabel } from "./rules.js";
import { getCurrentPattern, selectPattern, setTool } from "./tools.js";
import { syncAudioState } from "./audio.js";
import { drawSparkline, drawPatternPreview, ensureCanvasSize } from "./render.js";
import { setWrap } from "./sim.js";

// themes.setTheme is state-only. applyThemeToDOM writes the CSS custom
// properties, colorScheme, and accentPicker sync. Every caller of
// setTheme must pair it with this call; `themes.js` cannot reach the DOM
// per the middle-layer invariant.
export function applyThemeToDOM() {
  const theme = getTheme();
  const root = document.documentElement.style;
  root.setProperty("--bg", theme.colors.bg);
  root.setProperty("--bg-2", theme.colors.bg2);
  root.setProperty("--surface", theme.colors.surface);
  root.setProperty("--surface-strong", theme.colors.surfaceStrong);
  root.setProperty("--border", theme.colors.border);
  root.setProperty("--border-strong", theme.colors.borderStrong);
  root.setProperty("--text", theme.colors.text);
  root.setProperty("--text-dim", theme.colors.textDim);
  root.setProperty("--accent", theme.colors.accent);
  root.setProperty("--accent-rgb", theme.colors.accentRgb);
  root.setProperty("--ambient-a", theme.colors.ambientA);
  root.setProperty("--ambient-b", theme.colors.ambientB);
  root.setProperty("--grid-line", theme.colors.gridLine);
  root.setProperty("--success", theme.colors.success);
  root.setProperty("--danger", theme.colors.danger);
  document.documentElement.style.colorScheme = theme.mode;
  if (state.paletteId !== "custom" && els.accentPicker) {
    els.accentPicker.value = theme.colors.accent;
  }
}

// ---------- Toast + clipboard ----------

export function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastLayer.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch (_error) {
    showToast("Clipboard copy failed.");
  }
}

// ---------- Modals ----------

// Selector for all elements the Tab key can reach inside a modal.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]):not(.native-select-hidden), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

let activeSelect = null;
let activeSelectProxy = null;

// Per-open-modal: remember the element that had focus and the Tab-trap
// handler so closeModal can remove it cleanly. Stack supports nested modals.
const modalFocusStack = [];

function trapTabWithin(modal) {
  return (event) => {
    if (event.key !== "Tab") return;
    // Re-query every Tab: modal contents may have changed (pattern browser,
    // rule popover option rebuilds) since open time.
    const focusables = modal.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!focusables.length) { event.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
}

export function openModal(id) {
  // Idempotent: repeated open calls (e.g. `?` pressed while help modal is
  // already open) must not stack duplicate Tab-trap handlers or focus
  // snapshots on modalFocusStack. If the modal is already open, do nothing.
  if (state.modals.has(id)) return;
  const modal = document.getElementById(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  state.modals.add(id);

  const lastFocused = document.activeElement;
  const trapHandler = trapTabWithin(modal);
  modal.addEventListener("keydown", trapHandler);

  const firstFocusable = modal.querySelector(FOCUSABLE_SELECTOR);
  if (firstFocusable) firstFocusable.focus();

  modalFocusStack.push({ id, lastFocused, trapHandler });
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  state.modals.delete(id);

  // LIFO removal: peel off the topmost entry matching this id. Combined with
  // openModal's idempotency guard, this keeps modalFocusStack a true stack
  // even if some future path skips the guard.
  for (let i = modalFocusStack.length - 1; i >= 0; i -= 1) {
    if (modalFocusStack[i].id === id) {
      const { lastFocused, trapHandler } = modalFocusStack[i];
      modal.removeEventListener("keydown", trapHandler);
      modalFocusStack.splice(i, 1);
      if (lastFocused && typeof lastFocused.focus === "function"
          && document.body.contains(lastFocused)) {
        lastFocused.focus();
      }
      break;
    }
  }
}

export function closeTopModal() {
  const ids = Array.from(state.modals);
  const id = ids[ids.length - 1];
  if (id) { closeModal(id); return true; }
  return false;
}

export function isModalOpen() {
  return state.modals.size > 0;
}

// ---------- Speed controls ----------

export function adjustSpeed(delta) {
  if (state.speed === "max") state.speed = 60;
  state.speed = clamp(Number(state.speed) + delta, 1, 60);
}

// restoreFocus defaults to true for keyboard-driven close paths (option click,
// Escape). Callers who dismiss for reasons outside the user's focus intent
// (document-level outside-click, keyboard close from handleKeydown) should
// pass false so focus stays on whatever the user actually clicked or where
// the Escape handler already decided to put it.
export function closeSpeedPopover({ restoreFocus = true } = {}) {
  const hadFocusInside = els.speedPopover.contains(document.activeElement);
  els.speedPopover.classList.remove("visible");
  if (els.speedChip) els.speedChip.setAttribute("aria-expanded", "false");
  if (restoreFocus && hadFocusInside && els.speedChip) els.speedChip.focus();
}

// Closes the rule popover (built in app.js) and resets status-rule's
// aria-expanded. Exposed from ui.js so keyboard dispatch (handleKeydown)
// can close the popover from outside it.
export function closeRulePopover() {
  if (!els.rulePopover) return;
  els.rulePopover.classList.remove("visible");
  if (els.statusRule) els.statusRule.setAttribute("aria-expanded", "false");
}

export function openSpeedPopover() {
  const rect = els.speedChip.getBoundingClientRect();
  const popWidth = 200;
  els.speedPopover.style.left = `${Math.max(12, rect.left + rect.width / 2 - popWidth / 2)}px`;
  els.speedPopover.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  els.speedPopover.classList.add("visible");
  els.speedChip.setAttribute("aria-expanded", "true");
  // Keyboard users land on the first option; native Tab navigation then moves
  // through every option and the custom speed range.
  const firstOption = els.speedPopover.querySelector(".option");
  if (firstOption) firstOption.focus();
}

export function toggleSpeedPopover() {
  if (els.speedPopover.classList.contains("visible")) closeSpeedPopover();
  else openSpeedPopover();
}

// ---------- Custom select popover ----------

function getSelectLabel(select) {
  return select.selectedOptions[0]?.textContent || "Select";
}

function syncSelectProxyLabel(select) {
  if (!select?._proxyButton) return;
  select._proxyButton.querySelector(".select-proxy-label").textContent = getSelectLabel(select);
}

function closeSelectPopover({ restoreFocus = false } = {}) {
  if (!els.selectPopover) return;
  els.selectPopover.classList.remove("visible");
  els.selectPopover.innerHTML = "";
  els.selectPopover.removeAttribute("aria-activedescendant");
  if (activeSelectProxy) activeSelectProxy.setAttribute("aria-expanded", "false");
  const proxyToRestore = activeSelectProxy;
  activeSelect = null;
  activeSelectProxy = null;
  if (restoreFocus && proxyToRestore) proxyToRestore.focus();
}

function focusSelectOption(index) {
  const options = [...els.selectPopover.querySelectorAll(".select-option")];
  if (!options.length) return;
  const nextIndex = Math.max(0, Math.min(options.length - 1, index));
  options[nextIndex].focus();
  els.selectPopover.setAttribute("aria-activedescendant", options[nextIndex].id);
}

function chooseSelectOption(optionButton) {
  if (!activeSelect || !optionButton) return;
  activeSelect.value = optionButton.dataset.value;
  syncSelectProxyLabel(activeSelect);
  activeSelect.dispatchEvent(new Event("change", { bubbles: true }));
  closeSelectPopover({ restoreFocus: true });
}

function getRuleDescription() {
  const preset = RULESETS.find((item) => item.rule === state.rule);
  return preset ? preset.description : "Custom rule built from selected birth and survival counts.";
}

function createRuleDigitButton(section, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rule-digit";
  button.dataset.ruleSection = section;
  button.dataset.value = String(value);
  button.textContent = String(value);
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", `${section === "birth" ? "Birth" : "Survival"} count ${value}`);
  return button;
}

export function syncRuleLab() {
  const birth = state.rules?.birth || new Set();
  const survive = state.rules?.survive || new Set();
  [els.ruleBirthDigits, els.ruleSurviveDigits].forEach((group) => {
    if (!group) return;
    Array.from(group.children).forEach((button) => {
      const value = Number(button.dataset.value);
      const active = button.dataset.ruleSection === "birth"
        ? birth.has(value)
        : survive.has(value);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
  if (els.ruleDescription) els.ruleDescription.textContent = getRuleDescription();
}

function openSelectPopover(select, proxyButton) {
  if (activeSelect === select && els.selectPopover.classList.contains("visible")) {
    closeSelectPopover({ restoreFocus: true });
    return;
  }
  closeSelectPopover();
  activeSelect = select;
  activeSelectProxy = proxyButton;
  proxyButton.setAttribute("aria-expanded", "true");
  els.selectPopover.innerHTML = "";
  const rect = proxyButton.getBoundingClientRect();
  const estimatedHeight = Math.min(320, select.options.length * 42 + 12);
  const left = Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - rect.width - 10));
  const top = rect.bottom + 6 + estimatedHeight > window.innerHeight - 10
    ? Math.max(10, rect.top - estimatedHeight - 6)
    : rect.bottom + 6;
  els.selectPopover.style.left = `${left}px`;
  els.selectPopover.style.top = `${top}px`;
  els.selectPopover.style.minWidth = `${rect.width}px`;
  els.selectPopover.setAttribute("aria-label", proxyButton.getAttribute("aria-label") || "Select options");
  [...select.options].forEach((option, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.id = `${select.id}-option-${index}`;
    item.className = "select-option";
    item.dataset.value = option.value;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(option.value === select.value));
    item.textContent = option.textContent;
    if (option.value === select.value) item.classList.add("selected");
    item.addEventListener("click", () => chooseSelectOption(item));
    item.addEventListener("keydown", (event) => {
      const options = [...els.selectPopover.querySelectorAll(".select-option")];
      const currentIndex = options.indexOf(item);
      if (event.key === "ArrowDown") { event.preventDefault(); focusSelectOption(currentIndex + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); focusSelectOption(currentIndex - 1); }
      else if (event.key === "Home") { event.preventDefault(); focusSelectOption(0); }
      else if (event.key === "End") { event.preventDefault(); focusSelectOption(options.length - 1); }
      else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseSelectOption(item);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSelectPopover({ restoreFocus: true });
      }
    });
    els.selectPopover.appendChild(item);
  });
  els.selectPopover.classList.add("visible");
  const selectedIndex = Math.max(0, [...select.options].findIndex((option) => option.value === select.value));
  focusSelectOption(selectedIndex);
}

function upgradeSelect(select) {
  if (!select || select._proxyButton) return;
  select.classList.add("native-select-hidden");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  const proxy = document.createElement("button");
  proxy.type = "button";
  proxy.className = "select-proxy";
  proxy.setAttribute("aria-haspopup", "listbox");
  proxy.setAttribute("aria-expanded", "false");
  proxy.setAttribute("aria-controls", "select-popover");
  proxy.setAttribute("aria-label", select.getAttribute("aria-label") || "Choose option");
  proxy.innerHTML = '<span class="select-proxy-label"></span><span class="select-proxy-caret" aria-hidden="true">⌄</span>';
  proxy.addEventListener("click", (event) => {
    event.stopPropagation();
    openSelectPopover(select, proxy);
  });
  proxy.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSelectPopover(select, proxy);
    } else if (event.key === "Escape" && els.selectPopover.classList.contains("visible")) {
      event.preventDefault();
      event.stopPropagation();
      closeSelectPopover({ restoreFocus: true });
    }
  });
  select.addEventListener("change", () => syncSelectProxyLabel(select));
  select.after(proxy);
  select._proxyButton = proxy;
  syncSelectProxyLabel(select);
}

// ---------- Inspector drawer ----------

// Remember which element had focus when the inspector opened, so
// closeInspector can return to it. null when the drawer is closed.
let inspectorLastFocused = null;

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch (_error) {
    element.focus();
  }
}

export function openInspector() {
  inspectorLastFocused = document.activeElement;
  state.inspectorOpen = true;
  els.inspector.classList.add("open");
  els.inspector.setAttribute("aria-hidden", "false");
  els.inspectorToggle.setAttribute("aria-expanded", "true");
  document.body.classList.add("inspector-open");
  requestAnimationFrame(() => {
    if (state.inspectorOpen) focusWithoutScroll(els.inspectorClose);
  });
}

export function closeInspector() {
  state.inspectorOpen = false;
  els.inspector.classList.remove("open");
  els.inspector.setAttribute("aria-hidden", "true");
  els.inspectorToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("inspector-open");
  const target = (inspectorLastFocused && document.body.contains(inspectorLastFocused))
    ? inspectorLastFocused
    : els.inspectorToggle;
  if (target && typeof target.focus === "function") target.focus();
  inspectorLastFocused = null;
}

export function toggleInspector() {
  if (state.inspectorOpen) closeInspector();
  else openInspector();
}

// ---------- Pattern card ----------

// Skip the canvas redraw when nothing visible has changed. Called every
// frame via updateUI, so this gate avoids hundreds of drawRoundedRect
// calls/second for a preview that looks identical frame to frame.
// Key = (patternIndex, themeId, accent). Custom accents update state.accent
// without changing themeId, so the accent is part of the cache key.
let lastRenderedPatternIdx = -1;
let lastRenderedThemeId = null;
let lastRenderedAccent = null;

export function renderPatternCard() {
  const pattern = getCurrentPattern();
  if (els.patternCardName) els.patternCardName.textContent = pattern.name;
  if (els.patternCardCategory) els.patternCardCategory.textContent = pattern.category;
  if (!els.patternCardPreview) return;
  const themeId = getTheme().id;
  if (state.patternIndex === lastRenderedPatternIdx
      && themeId === lastRenderedThemeId
      && state.accent === lastRenderedAccent) {
    return;
  }
  drawPatternPreview(els.patternCardPreview, pattern, state.accent);
  lastRenderedPatternIdx = state.patternIndex;
  lastRenderedThemeId = themeId;
  lastRenderedAccent = state.accent;
}

// ---------- Sparkline popover ----------

export function showSparklinePopover() {
  if (!els.sparklinePopover) return;
  els.sparklinePopover.classList.add("visible");
  // The sparkline canvas backing store may have been skipped while the
  // popover was hidden (see ensureCanvasSize). Resize now that layout has
  // given it real dimensions, then draw.
  ensureCanvasSize(window.devicePixelRatio || 1);
  drawSparkline();
}

export function hideSparklinePopover() {
  if (!els.sparklinePopover) return;
  els.sparklinePopover.classList.remove("visible");
}

// ---------- Pattern library modal ----------

export function renderPatternBrowser() {
  const search = els.patternSearch.value.trim().toLowerCase();
  const category = els.patternCategory.value || "All";
  els.patternBrowserGrid.innerHTML = "";
  PATTERNS.filter((pattern) => {
    const matchesCategory = category === "All" || pattern.category === category;
    const haystack = `${pattern.name} ${pattern.category} ${pattern.description}`.toLowerCase();
    return matchesCategory && (!search || haystack.includes(search));
  }).forEach((pattern) => {
    const realIndex = PATTERNS.indexOf(pattern);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "pattern-card";
    const name = document.createElement("div");
    name.innerHTML = `<div class="title" style="font-size:15px">${pattern.name}</div><div class="subtitle">${pattern.category}</div>`;
    const preview = document.createElement("canvas");
    preview.width = 120;
    preview.height = 78;
    drawPatternPreview(preview, pattern, state.accent);
    const description = document.createElement("div");
    description.className = "subtitle";
    description.textContent = pattern.description;
    card.append(name, preview, description);
    card.addEventListener("click", () => {
      selectPattern(realIndex, true);
      closeModal("pattern-modal");
      showToast(`${pattern.name} selected.`);
      updateUI();
    });
    els.patternBrowserGrid.appendChild(card);
  });
}

// ---------- Setup (populate the DOM with dynamic content) ----------

const TOOL_ICONS = {
  freehand: '<svg viewBox="0 0 20 20"><path d="M4 16l3-1 8-8-2-2-8 8-1 3z" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  eraser:   '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="5" height="5" rx="1"/><rect x="11" y="4" width="5" height="5" rx="1"/><rect x="4" y="11" width="5" height="5" rx="1"/><rect x="11" y="11" width="5" height="5" rx="1"/><path d="M3 17L17 3" stroke-linecap="round"/></svg>',
  stamp:    '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="5" height="5" rx="1"/><rect x="11" y="4" width="5" height="5" rx="1"/><rect x="4" y="11" width="5" height="5" rx="1"/><rect x="11" y="11" width="5" height="5" rx="1"/></svg>',
  line:     '<svg viewBox="0 0 20 20"><path d="M4 16L16 4" stroke-linecap="round"/></svg>',
  box:      '<svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="1"/></svg>',
  circle:   '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6"/></svg>',
};

export function setupUI() {
  // Ruleset select (Advanced)
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
  upgradeSelect(els.rulesetSelect);

  for (let value = 0; value <= 8; value += 1) {
    els.ruleBirthDigits.appendChild(createRuleDigitButton("birth", value));
    els.ruleSurviveDigits.appendChild(createRuleDigitButton("survive", value));
  }

  // Pattern category (pattern modal)
  CATEGORY_OPTIONS.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.patternCategory.appendChild(option);
  });
  upgradeSelect(els.patternCategory);

  // Tool grid — icon-only buttons
  TOOL_ORDER.forEach((tool) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tool = tool.id;
    button.setAttribute("aria-label", tool.label);
    button.innerHTML = TOOL_ICONS[tool.id] || tool.label;
    button.addEventListener("click", () => { setTool(tool.id); updateUI(); });
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
    button.setAttribute("aria-pressed", String(!!state[key]));
    button.addEventListener("click", () => {
      if (key === "wrap") setWrap(!state.wrap);
      else state[key] = !state[key];
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
    swatch.title = theme.name;
    swatch.style.background = `linear-gradient(135deg, ${theme.colors.bg} 0%, ${theme.colors.bg2} 60%, ${theme.colors.accent} 100%)`;
    swatch.addEventListener("click", () => {
      setTheme(theme.id);
      applyThemeToDOM();
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
  customRow.innerHTML = `<input type="range" min="1" max="60" step="1" value="${state.speed === "max" ? 60 : state.speed}" aria-label="Custom speed">`;
  const rangeInput = customRow.querySelector("input");
  rangeInput.addEventListener("input", () => {
    state.speed = Number(rangeInput.value);
    updateUI();
  });
  els.speedPopover.appendChild(customRow);

  // Escape inside the speed popover closes it and returns focus to the trigger.
  // Stop propagation so the document-level handleKeydown doesn't also run
  // closeTopModal / closeInspector for the same keystroke.
  els.speedPopover.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.speedPopover.classList.contains("visible")) {
      event.preventDefault();
      event.stopPropagation();
      closeSpeedPopover();
    }
  });

  document.addEventListener("click", (event) => {
    if (!els.selectPopover?.classList.contains("visible")) return;
    if (els.selectPopover.contains(event.target) || activeSelectProxy?.contains(event.target)) return;
    closeSelectPopover();
  });

  renderPatternBrowser();
  renderPatternCard();
}

// ---------- updateUI (called every frame) ----------

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
  els.toolActiveLabel.textContent = toolLabels[state.currentTool] || `${capitalize(state.currentTool)} tool active`;
  Array.from(els.toolGrid.children).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === state.currentTool);
  });

  // Behavior toggles
  Array.from(els.toggleButtons.children).forEach((btn) => {
    const pressed = !!state[btn.dataset.toggle];
    btn.classList.toggle("active", pressed);
    btn.setAttribute("aria-pressed", String(pressed));
  });

  // Theme swatches
  Array.from(els.themeSwatches.children).forEach((sw) => {
    sw.classList.toggle("active", sw.dataset.theme === getTheme().id);
  });

  // Rule controls
  els.rulesetSelect.value = RULESETS.find((r) => r.rule === state.rule) ? state.rule : "custom";
  syncSelectProxyLabel(els.rulesetSelect);
  els.ruleInput.value = state.rule;
  syncRuleLab();
  if (els.exportNote) els.exportNote.textContent = `Exports use ${state.rule}.`;
  els.accentPicker.value = state.accent;

  // Pattern card
  renderPatternCard();
}

// ---------- Perf counters (internal state; no DOM output) ----------

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

export { hexToRgb };

// ---------- Theme cycle (keyboard T) ----------

export function cycleTheme() {
  setTheme(THEMES[(state.themeIndex + 1) % THEMES.length].id);
  applyThemeToDOM();
  showToast(`${getTheme().name} theme`);
  updateUI();
}
