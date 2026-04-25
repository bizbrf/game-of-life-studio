// App entry point: wires DOM references, binds events, runs the RAF loop.

import { BASE_CELL_SIZE, MIN_ZOOM, MAX_ZOOM, RULESETS } from "./constants.js";
import { state, els, canvasRefs } from "./state.js";
import { clamp, xyFromKey } from "./utils.js";
import { applyRule } from "./rules.js";
import { setTheme, getTheme } from "./themes.js";
import { restoreSnapshot, pushSimulationSnapshot, undo, redo } from "./history.js";
import { stepSimulation, resetSimulation, randomFill, updateSimulation, commitStroke } from "./sim.js";
import { getCurrentPattern, selectPattern, setTool } from "./tools.js";
import { configureAudioContext, syncAudioState } from "./audio.js";
import {
  ensureCanvasSize,
  draw,
  updateParticles,
  visibleWorldBounds,
} from "./render.js";
import {
  exportToJson,
  exportToRle,
  importJson,
  importRle,
} from "./io.js";
import {
  setupUI,
  updateUI,
  updatePerformanceCounters,
  renderPatternBrowser,
  showToast,
  copyText,
  openModal,
  closeModal,
  closeTopModal,
  isModalOpen,
  adjustSpeed,
  hexToRgb,
  toggleSpeedPopover,
  closeSpeedPopover,
  closeRulePopover,
  closeInspector,
  toggleInspector,
  cycleTheme,
  applyThemeToDOM,
  showSparklinePopover,
  hideSparklinePopover,
} from "./ui.js";
import {
  beginInteraction,
  updateInteraction,
  endInteraction,
  zoomAt,
  autoFit,
} from "./input.js";

// Orchestrator helper: applies a rule change coming from a user action and
// surfaces the outcome via toast + updateUI. Keeps rules.js dependency-direction
// clean (no showToast / updateUI imports in the middle layer).
function applyRuleAndToast(ruleString) {
  const result = applyRule(ruleString);
  if (!result.success) showToast(result.message);
  else showToast(`Ruleset set to ${result.rule}`);
  updateUI();
  return result;
}

// Keyboard shortcuts live here (not in input.js) so input.js stays free of
// ui.js / audio.js / history.js upward imports. app.js is the legitimate
// orchestrator that can talk to every module.
function handleKeydown(event) {
  if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
    if (event.key === "Escape") event.target.blur();
    return;
  }
  // When a modal is open, let the modal's own Tab-trap handler drive focus.
  // Without this guard, the document-level Tab case below would also fire
  // selectPattern + preventDefault on every Tab, breaking the trap and
  // quietly mutating state.patternIndex.
  if (event.key === "Tab" && isModalOpen()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    // Close the topmost overlay first: modal > inspector > popover. Modals
    // and inspector sit ABOVE popovers in the visual / semantic stack, so
    // Escape must peel them off before touching a background popover.
    if (closeTopModal()) return;
    if (state.inspectorOpen) { closeInspector(); return; }
    if (els.rulePopover && els.rulePopover.classList.contains("visible")) {
      closeRulePopover();
      return;
    }
    if (els.speedPopover && els.speedPopover.classList.contains("visible")) {
      closeSpeedPopover({ restoreFocus: false });
      return;
    }
  }
  // While a modal is open, the document-level global shortcuts (Space, R,
  // F, G, W, T, 1-6, Tab, Ctrl+K/Z) must not fire — they would mutate sim
  // state from behind the dialog and hijack Space/Enter activations on the
  // modal's focused button.
  if (isModalOpen()) return;
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    toggleInspector();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    const result = undo();
    if (!result.success) showToast(result.message);
    updateUI();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    const result = redo();
    if (!result.success) showToast(result.message);
    updateUI();
    return;
  }
  switch (event.key) {
    case " ": event.preventDefault(); state.simulating = !state.simulating; syncAudioState(); break;
    case "n": case "N": if (!state.simulating) stepSimulation(); break;
    case "r": case "R": resetSimulation(); break;
    case "f": case "F": showToast(randomFill(visibleWorldBounds(0)).message); break;
    case "g": case "G": state.gridLines = !state.gridLines; break;
    case "w": case "W": state.wrap = !state.wrap; break;
    case "t": case "T": cycleTheme(); break;
    case "h": case "H":
      state.modals.has("help-modal") ? closeModal("help-modal") : openModal("help-modal");
      break;
    case "?": event.preventDefault(); openModal("help-modal"); break;
    case "Tab":
      event.preventDefault();
      selectPattern(state.patternIndex + (event.shiftKey ? -1 : 1), true);
      updateUI();
      break;
    case "+": case "=": adjustSpeed(2); break;
    case "-": case "_": adjustSpeed(-2); break;
    case "[": adjustSpeed(-1); break;
    case "]": adjustSpeed(1); break;
    case "1": setTool("freehand"); break;
    case "2": setTool("eraser"); break;
    case "3": setTool("stamp"); break;
    case "4": setTool("line"); break;
    case "5": setTool("box"); break;
    case "6": setTool("circle"); break;
    default: break;
  }
  updateUI();
}

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
    // Popovers
    "sparkline-popover", "speed-popover", "rule-popover", "select-popover",
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
    // Modals
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

function advanceSimulationBy(ms) {
  const dt = Math.min(ms / 1000, 0.1);
  updateParticles(dt);
  updateSimulation(dt);
  draw();
}

function bindEvents() {
  const { canvas } = canvasRefs;

  window.addEventListener("resize", () => { ensureCanvasSize(window.devicePixelRatio || 1); draw(); updateUI(); });
  document.addEventListener("keydown", handleKeydown);

  // ----- Canvas input -----
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
  canvas.addEventListener("dblclick", (event) => { event.preventDefault(); autoFit(); updateUI(); });
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

  // Touch
  canvas.addEventListener("touchstart", (event) => {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      beginInteraction("paint", touch.clientX, touch.clientY, 0);
    } else if (event.touches.length === 2) {
      if (state.interaction && state.interaction.strokeBefore) {
        const label = state.interaction.type === "draw-paint" ? "Paint stroke" : "Erase stroke";
        commitStroke(state.interaction.strokeBefore, label);
      }
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
      const size = BASE_CELL_SIZE * state.camera.zoom;
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

  // ----- Playback pill -----
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

  // ----- Status strip: rule popover + sparkline hover -----
  // closeRulePopover is exported from ui.js so handleKeydown (above) can
  // dismiss the popover on Escape without ui.js reaching down into DOM
  // wiring that lives in this file.
  els.statusRule.addEventListener("click", () => {
    const alreadyOpen = els.rulePopover.classList.contains("visible");
    if (alreadyOpen) { closeRulePopover(); return; }
    const rect = els.statusRule.getBoundingClientRect();
    els.rulePopover.innerHTML = "";
    RULESETS.forEach((ruleset) => {
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "option" + (state.rule === ruleset.rule ? " selected" : "");
      opt.innerHTML = `<span>${ruleset.label}</span><span class="meta">${ruleset.rule}</span>`;
      opt.addEventListener("click", () => {
        applyRuleAndToast(ruleset.rule);
        closeRulePopover();
        els.statusRule.focus();
      });
      els.rulePopover.appendChild(opt);
    });
    const customRow = document.createElement("div");
    customRow.className = "custom-row";
    customRow.innerHTML = `<input type="text" value="${state.rule}" spellcheck="false" placeholder="B/S notation" aria-label="Custom B/S rule">`;
    const input = customRow.querySelector("input");
    input.addEventListener("change", () => {
      applyRuleAndToast(input.value);
      closeRulePopover();
      els.statusRule.focus();
    });
    els.rulePopover.appendChild(customRow);
    els.rulePopover.style.left = `${rect.left}px`;
    els.rulePopover.style.top = `${rect.bottom + 8}px`;
    els.rulePopover.classList.add("visible");
    els.statusRule.setAttribute("aria-expanded", "true");
    // Move focus to the first option so keyboard users land inside the menu.
    const firstOption = els.rulePopover.querySelector("button.option");
    if (firstOption) firstOption.focus();
  });
  // Escape inside the rule popover closes it and returns focus to the trigger.
  // Stop propagation so the document-level handleKeydown doesn't also run
  // closeTopModal / closeInspector for the same keystroke.
  els.rulePopover.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.rulePopover.classList.contains("visible")) {
      event.preventDefault();
      event.stopPropagation();
      closeRulePopover();
      els.statusRule.focus();
    }
  });

  let popHoverTimer = null;
  function schedulePopShow() {
    popHoverTimer = setTimeout(() => showSparklinePopover(), 120);
  }
  function schedulePopHide() {
    if (popHoverTimer) clearTimeout(popHoverTimer);
    setTimeout(() => hideSparklinePopover(), 80);
  }
  els.statusPopToken.addEventListener("mouseenter", schedulePopShow);
  els.statusPopToken.addEventListener("mouseleave", schedulePopHide);
  // Keyboard equivalents: focusing the pop token shows the popover.
  els.statusPopToken.addEventListener("focusin", schedulePopShow);
  els.statusPopToken.addEventListener("focusout", schedulePopHide);

  // ----- Inspector: Scene row -----
  els.fitBtn.addEventListener("click", () => { autoFit(); updateUI(); });
  els.randomBtn.addEventListener("click", () => {
    const result = randomFill(visibleWorldBounds(0));
    showToast(result.message);
    updateUI();
  });
  els.resetBtn.addEventListener("click", () => { resetSimulation(); updateUI(); });
  els.ioBtn.addEventListener("click", () => openModal("io-modal"));
  els.helpBtn.addEventListener("click", () => openModal("help-modal"));

  // ----- Inspector: Pattern card -----
  els.patternCard.addEventListener("click", () => openModal("pattern-modal"));

  // ----- Inspector: Rule advanced controls -----
  els.rulesetSelect.addEventListener("change", () => {
    if (els.rulesetSelect.value === "custom") { els.ruleInput.focus(); return; }
    applyRuleAndToast(els.rulesetSelect.value);
  });
  els.ruleInput.addEventListener("change", () => {
    applyRuleAndToast(els.ruleInput.value);
  });

  // ----- Inspector: Accent picker -----
  els.accentPicker.addEventListener("input", () => {
    state.accent = els.accentPicker.value;
    state.paletteId = "custom";
    const { r, g, b } = hexToRgb(state.accent);
    document.documentElement.style.setProperty("--accent", state.accent);
    document.documentElement.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
    updateUI();
    renderPatternBrowser();
  });

  // ----- Inspector: Undo / Redo -----
  els.undoBtn.addEventListener("click", () => {
    const result = undo();
    if (!result.success) showToast(result.message);
    updateUI();
  });
  els.redoBtn.addEventListener("click", () => {
    const result = redo();
    if (!result.success) showToast(result.message);
    updateUI();
  });

  // ----- Inspector: History rewind -----
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

  // ----- Pattern modal -----
  els.patternSearch.addEventListener("input", renderPatternBrowser);
  els.patternCategory.addEventListener("change", renderPatternBrowser);

  // ----- I/O modal -----
  els.importRleBtn.addEventListener("click", () => {
    try { importRle(els.importText.value); showToast("RLE imported at camera center."); updateUI(); }
    catch (error) { showToast(error.message || "RLE import failed."); }
  });
  els.importJsonBtn.addEventListener("click", () => {
    try {
      importJson(els.importText.value);
      // importJson can call setTheme (state only); project the theme to DOM
      // so the 15 CSS custom properties pick up the imported theme.
      applyThemeToDOM();
      showToast("JSON imported.");
      updateUI();
    }
    catch (error) { showToast(error.message || "JSON import failed."); }
  });
  els.uploadBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files[0];
    if (!file) return;
    try {
      els.importText.value = await file.text();
      showToast(`Loaded ${file.name}`);
    } catch (error) {
      const message = error?.message || (error == null ? "read failed" : String(error));
      showToast(`Could not read ${file.name}: ${message}`);
    }
  });
  els.exportRleBtn.addEventListener("click", () => { els.exportText.value = exportToRle(); });
  els.exportJsonBtn.addEventListener("click", () => { els.exportText.value = exportToJson(); });
  els.copyExportBtn.addEventListener("click", () => {
    if (els.exportText.value) copyText(els.exportText.value);
  });

  // ----- Modals: close / backdrop -----
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    });
  });

  // ----- Dismiss popovers on outside click -----
  document.addEventListener("click", (event) => {
    if (els.speedPopover.classList.contains("visible")
        && !els.speedPopover.contains(event.target)
        && event.target !== els.speedChip) {
      // Outside-click: don't yank focus back to the chip — focus belongs
      // wherever the user just clicked.
      closeSpeedPopover({ restoreFocus: false });
    }
    if (els.rulePopover.classList.contains("visible")
        && !els.rulePopover.contains(event.target)
        && event.target !== els.statusRule) {
      closeRulePopover();
    }
  });
}

function renderGameToText() {
  const visibleBounds = visibleWorldBounds(0);
  const visibleCells = [];
  for (const [key, age] of state.liveCells.entries()) {
    const [x, y] = xyFromKey(key);
    if (x >= visibleBounds.minX && x <= visibleBounds.maxX
        && y >= visibleBounds.minY && y <= visibleBounds.maxY) {
      visibleCells.push({ x, y, age });
    }
    if (visibleCells.length >= 80) break;
  }
  return JSON.stringify({
    coordinate_system: {
      origin: "world cell coordinates centered on camera",
      x_axis: "positive right",
      y_axis: "positive down",
    },
    mode: state.simulating ? "running" : state.browsingHistory ? "rewind" : "paused",
    tool: state.currentTool,
    pattern: getCurrentPattern().name,
    rule: state.rule,
    generation: state.generation,
    population: state.liveCells.size,
    speed: state.speed,
    wrap: state.wrap,
    grid_lines: state.gridLines,
    camera: {
      x: Number(state.camera.x.toFixed(2)),
      y: Number(state.camera.y.toFixed(2)),
      zoom: Number(state.camera.zoom.toFixed(2)),
    },
    visible_bounds: visibleBounds,
    visible_cells: visibleCells,
  });
}

function updateLoop(now) {
  const dt = Math.min(0.1, (now - state.lastFrameTime) / 1000);
  state.lastFrameTime = now;
  updatePerformanceCounters(dt);
  updateParticles(dt);
  updateSimulation(dt);
  draw();
  updateUI();
  requestAnimationFrame(updateLoop);
}

function initialize() {
  configureAudioContext(window.AudioContext);
  hydrateDomReferences();
  setupUI();
  ensureCanvasSize(window.devicePixelRatio || 1);
  applyRule(state.rule);
  setTheme("obsidian", true);
  state.paletteId = getTheme().defaultPalette;
  applyThemeToDOM();
  // Respect prefers-reduced-motion: disable floating background particles.
  // CSS handles transitions / keyframes; this handles the JS-driven particle
  // animation loop.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    state.particles = false;
  }
  pushSimulationSnapshot();
  bindEvents();
  updateUI();
  requestAnimationFrame(updateLoop);
}

// Public test hooks.
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => { advanceSimulationBy(ms); };
window.__gameOfLifeV2 = { state, exportToJson, exportToRle };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
