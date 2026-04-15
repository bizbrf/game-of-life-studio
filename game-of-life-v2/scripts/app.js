// App entry point: wires DOM references, binds events, runs the RAF loop.

import { MIN_ZOOM, MAX_ZOOM, RULESETS } from "./constants.js";
import { state, els, canvasRefs } from "./state.js";
import { clamp, xyFromKey } from "./utils.js";
import { applyRule } from "./rules.js";
import { setTheme, getTheme } from "./themes.js";
import { restoreSnapshot, pushSimulationSnapshot, undo, redo } from "./history.js";
import { stepSimulation, resetSimulation, randomFill, updateSimulation, commitStroke } from "./sim.js";
import { getCurrentPattern } from "./tools.js";
import { syncAudioState } from "./audio.js";
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
  applyThemeToDOM,
  showToast,
  copyText,
  openModal,
  closeModal,
  adjustSpeed,
  toggleSpeedPopover,
  closeSpeedPopover,
  closeRulePopover,
  closeInspector,
  toggleInspector,
  showSparklinePopover,
  hideSparklinePopover,
} from "./ui.js";
import {
  beginInteraction,
  updateInteraction,
  endInteraction,
  zoomAt,
  autoFit,
  handleKeydown,
} from "./input.js";

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
    "sparkline-popover", "speed-popover", "rule-popover",
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

  window.addEventListener("resize", () => {
    ensureCanvasSize(window.devicePixelRatio || 1);
    draw();
    updateUI();
  });
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
  // closeRulePopover is defined in ui.js so handleKeydown (which lives in
  // input.js) can close the popover on Escape without a separate import here.
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
        applyRule(ruleset.rule, true);
        closeRulePopover();
        els.statusRule.focus();
        updateUI();
      });
      els.rulePopover.appendChild(opt);
    });
    const customRow = document.createElement("div");
    customRow.className = "custom-row";
    customRow.innerHTML = `<input type="text" value="${state.rule}" spellcheck="false" placeholder="B/S notation" aria-label="Custom B/S rule">`;
    const input = customRow.querySelector("input");
    input.addEventListener("change", () => {
      applyRule(input.value, true);
      closeRulePopover();
      els.statusRule.focus();
      updateUI();
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
  els.fitBtn.addEventListener("click", () => autoFit());
  els.randomBtn.addEventListener("click", () => { randomFill(visibleWorldBounds(0)); updateUI(); });
  els.resetBtn.addEventListener("click", () => { resetSimulation(); updateUI(); });
  els.ioBtn.addEventListener("click", () => openModal("io-modal"));
  els.helpBtn.addEventListener("click", () => openModal("help-modal"));

  // ----- Inspector: Pattern card -----
  els.patternCard.addEventListener("click", () => openModal("pattern-modal"));

  // ----- Inspector: Rule advanced controls -----
  els.rulesetSelect.addEventListener("change", () => {
    if (els.rulesetSelect.value === "custom") { els.ruleInput.focus(); return; }
    applyRule(els.rulesetSelect.value, true);
    updateUI();
  });
  els.ruleInput.addEventListener("change", () => {
    applyRule(els.ruleInput.value, true);
    updateUI();
  });

  // ----- Inspector: Accent picker -----
  els.accentPicker.addEventListener("input", () => {
    state.accent = els.accentPicker.value;
    state.paletteId = "custom";
    applyThemeToDOM();
    updateUI();
    renderPatternBrowser();
  });

  // ----- Inspector: Undo / Redo -----
  els.undoBtn.addEventListener("click", () => { undo(); updateUI(); });
  els.redoBtn.addEventListener("click", () => { redo(); updateUI(); });

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
      // so the CSS variables follow the imported theme.
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
    const text = await file.text();
    els.importText.value = text;
    showToast(`Loaded ${file.name}`);
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

// Public test hooks (preserved from the single-file build).
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => { advanceSimulationBy(ms); };
window.__gameOfLifeV2 = { state, exportToJson, exportToRle };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
