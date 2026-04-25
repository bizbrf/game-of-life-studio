// Pointer / touch interaction and camera zoom + autoFit.
// Keyboard handling lives in app.js (handleKeydown) so this module stays
// out of the ui.js / audio.js upward-import territory.

import { BASE_CELL_SIZE, MIN_ZOOM, MAX_ZOOM } from "./constants.js";
import { state, els, canvasRefs } from "./state.js";
import { clamp, xyFromKey } from "./utils.js";
import { getCurrentPattern, getPatternOffsetCells, getToolCells } from "./tools.js";
import { addCells, commitStroke } from "./sim.js";
import { screenToWorld } from "./render.js";

// Right-click tap vs. drag threshold. A movement of more than 6 px
// converts the gesture from a single-cell erase into a canvas pan. 6 px
// matches the browser's native click-vs-drag feel and is generous enough
// that an accidental tremor during a right-click tap doesn't get misread
// as a pan. Squared because updateInteraction compares dx²+dy² to avoid
// a per-frame sqrt.
const PAN_DRAG_THRESHOLD_PX = 6;
const PAN_DRAG_THRESHOLD_SQ = PAN_DRAG_THRESHOLD_PX * PAN_DRAG_THRESHOLD_PX;

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
  if (kind === "erase") {
    // Tentative: a short right-click tap erases one cell (committed in
    // endInteraction); a drag past PAN_DRAG_THRESHOLD_PX converts to pan.
    // Keeps the prior "right-click = erase" shortcut while adding the
    // map-UI convention of right-drag to pan. Cursor stays `crosshair`
    // until we actually convert to pan — switching to `grabbing` on every
    // right-click would mislead users who just want to tap-erase.
    state.interaction = {
      type: "erase-or-pan",
      startClientX: clientX,
      startClientY: clientY,
      startCameraX: state.camera.x,
      startCameraY: state.camera.y,
      start: world,
      button,
    };
    return;
  }
  // Left-click with eraser tool active erases without the tap/drag
  // gymnastics — eraser is a tool, not a shortcut, so drag is the normal
  // way to erase a stroke.
  const erase = state.currentTool === "eraser";
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
  const { canvas } = canvasRefs;
  const world = screenToWorld(clientX, clientY);
  state.hoverCell = world;
  if (state.interaction.type === "erase-or-pan") {
    const dx = clientX - state.interaction.startClientX;
    const dy = clientY - state.interaction.startClientY;
    if (dx * dx + dy * dy <= PAN_DRAG_THRESHOLD_SQ) return;
    // Drag exceeded the threshold — commit to pan for the rest of this
    // gesture. Flip the cursor now (we held off in beginInteraction so a
    // tap-erase wouldn't flash the pan cursor), then fall through to the
    // pan branch below so this tick moves the camera instead of waiting
    // for the next mousemove.
    state.interaction.type = "pan";
    canvas.style.cursor = "grabbing";
  }
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
  if (interaction.type === "erase-or-pan") {
    // Gesture ended before reaching the drag threshold — commit as a
    // single-cell erase at the click point.
    addCells([[interaction.start.x, interaction.start.y]], false, "Erase cell");
    return;
  }
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
