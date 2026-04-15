// Pointer / touch interaction and camera zoom + autoFit.
// Keyboard handling lives in app.js (handleKeydown) so this module stays
// out of the ui.js / audio.js upward-import territory.

import { BASE_CELL_SIZE, MIN_ZOOM, MAX_ZOOM } from "./constants.js";
import { state, els, canvasRefs } from "./state.js";
import { clamp, xyFromKey } from "./utils.js";
import { getCurrentPattern, getPatternOffsetCells, getToolCells } from "./tools.js";
import { addCells, commitStroke } from "./sim.js";
import { screenToWorld } from "./render.js";

export function beginInteraction(kind, clientX, clientY, button = 0) {
  if (state.modals.size > 0) return;
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

// Callers (app.js) call updateUI() after autoFit; this module no longer
// reaches upward into ui.js.
export function autoFit() {
  const { canvas } = canvasRefs;
  if (!state.liveCells.size) {
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.zoom = 1;
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
}
