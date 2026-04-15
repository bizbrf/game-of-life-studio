// Pointer/touch/keyboard interaction, zoom, autoFit.

import { BASE_CELL_SIZE, MIN_ZOOM, MAX_ZOOM } from "./constants.js";
import { state, els, canvasRefs } from "./state.js";
import { clamp, xyFromKey } from "./utils.js";
import { getCurrentPattern, getPatternOffsetCells, getToolCells, setTool } from "./tools.js";
import { addCells, commitStroke, stepSimulation, resetSimulation, randomFill } from "./sim.js";
import { screenToWorld, visibleWorldBounds } from "./render.js";
import { undo, redo } from "./history.js";
import {
  updateUI,
  openModal,
  closeModal,
  closeTopModal,
  isModalOpen,
  adjustSpeed,
  cycleTheme,
  toggleInspector,
  closeInspector,
  closeSpeedPopover,
  closeRulePopover,
} from "./ui.js";
import { syncAudioState } from "./audio.js";

export function beginInteraction(kind, clientX, clientY, button = 0) {
  if (isModalOpen()) return;
  const { canvas } = canvasRefs;
  const world = screenToWorld(clientX, clientY);
  state.hoverCell = world;
  if (kind === "pan") {
    state.interaction = {
      type: "pan",
      startClientX: clientX,
      startClientY: clientY,
      startCameraX: state.camera.x,
      startCameraY: state.camera.y,
    };
    canvas.style.cursor = "grabbing";
    return;
  }
  // When the eraser tool is active, every pointer-down erases regardless of
  // which button (or touch) triggered it. Without this, left-click with the
  // eraser tool selected would paint cells alive instead of removing them.
  const erase = kind === "erase" || button === 2 || state.currentTool === "eraser";
  state.interaction = {
    type: erase ? "draw-erase" : "draw-paint",
    start: world,
    current: world,
    button,
  };
  if (state.currentTool === "freehand" || state.currentTool === "eraser") {
    state.interaction.strokeBefore = new Map();
    addCells([[world.x, world.y]], !erase, "", false, state.interaction.strokeBefore);
  } else if (state.currentTool === "stamp") {
    addCells(getPatternOffsetCells(world.x, world.y), !erase, erase ? "Erase stamp" : `Stamp ${getCurrentPattern().name}`);
  }
}

export function updateInteraction(clientX, clientY) {
  if (!state.interaction) {
    state.hoverCell = screenToWorld(clientX, clientY);
    return;
  }
  const world = screenToWorld(clientX, clientY);
  state.hoverCell = world;
  if (state.interaction.type === "pan") {
    const size = BASE_CELL_SIZE * state.camera.zoom;
    state.camera.x = state.interaction.startCameraX - (clientX - state.interaction.startClientX) / size;
    state.camera.y = state.interaction.startCameraY - (clientY - state.interaction.startClientY) / size;
    return;
  }
  state.interaction.current = world;
  if (state.currentTool === "freehand" || state.currentTool === "eraser") {
    addCells(
      [[world.x, world.y]],
      state.interaction.type === "draw-paint",
      "",
      false,
      state.interaction.strokeBefore,
    );
  }
}

export function endInteraction() {
  if (!state.interaction) return;
  const { canvas } = canvasRefs;
  const interaction = state.interaction;
  state.interaction = null;
  canvas.style.cursor = "crosshair";
  if (interaction.type === "pan") return;
  if (interaction.type === "touch-panzoom") return;
  if (interaction.strokeBefore) {
    const label = interaction.type === "draw-paint" ? "Paint stroke" : "Erase stroke";
    commitStroke(interaction.strokeBefore, label);
    return;
  }
  if (["line", "box", "circle"].includes(state.currentTool)) {
    addCells(
      getToolCells(interaction.start, interaction.current || interaction.start),
      interaction.type === "draw-paint",
      interaction.type === "draw-paint" ? `Draw ${state.currentTool}` : `Erase ${state.currentTool}`,
    );
  }
}

export function zoomAt(clientX, clientY, direction) {
  const { canvas } = canvasRefs;
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const before = screenToWorld(clientX, clientY);
  const zoomFactor = direction > 0 ? 1.1 : 0.9;
  state.camera.zoom = clamp(state.camera.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
  const size = BASE_CELL_SIZE * state.camera.zoom;
  state.camera.x = before.x - (localX - canvas.clientWidth / 2) / size;
  state.camera.y = before.y - (localY - canvas.clientHeight / 2) / size;
}

export function autoFit() {
  const { canvas } = canvasRefs;
  if (!state.liveCells.size) {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.zoom = 1;
    updateUI();
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const key of state.liveCells.keys()) {
    const [x, y] = xyFromKey(key);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const width = Math.max(6, maxX - minX + 4);
  const height = Math.max(6, maxY - minY + 4);
  state.camera.x = (minX + maxX) / 2;
  state.camera.y = (minY + maxY) / 2;
  state.camera.zoom = clamp(
    Math.min(canvas.clientWidth / (width * BASE_CELL_SIZE), canvas.clientHeight / (height * BASE_CELL_SIZE)),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  updateUI();
}

export function handleKeydown(event) {
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
    // Escape must peel them off before touching a background popover. The
    // popover's own keydown handler (installed on openModal's trapped
    // modal element) takes care of Escape while focus is INSIDE the
    // popover; this branch catches the case where focus has left it.
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
  // While a modal is open, the document-level global shortcuts
  // (Space/play-pause, R/reset, F/fill, G/grid, W/wrap, T/theme, 1-6 tools,
  // Tab/pattern-cycle, etc.) must not fire — they would mutate sim state
  // from behind the dialog and hijack Space / Enter activations on the
  // modal's focused button. Tab is already guarded above; short-circuit
  // everything else here too.
  if (isModalOpen()) return;
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    toggleInspector();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    updateUI();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    redo();
    updateUI();
    return;
  }
  switch (event.key) {
    case " ": event.preventDefault(); state.simulating = !state.simulating; syncAudioState(); break;
    case "n": case "N": if (!state.simulating) stepSimulation(); break;
    case "r": case "R": resetSimulation(); break;
    case "f": case "F": randomFill(visibleWorldBounds(0)); break;
    case "g": case "G": state.gridLines = !state.gridLines; break;
    case "w": case "W": state.wrap = !state.wrap; break;
    case "t": case "T": cycleTheme(); break;
    case "h": case "H":
      state.modals.has("help-modal") ? closeModal("help-modal") : openModal("help-modal");
      break;
    case "?": event.preventDefault(); openModal("help-modal"); break;
    case "Tab":
      event.preventDefault();
      // Lazy import avoids a load-order cycle with tools.js
      import("./tools.js").then(({ selectPattern }) => {
        selectPattern(state.patternIndex + (event.shiftKey ? -1 : 1), true);
      });
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
