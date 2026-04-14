// Drawing tool geometry and tool/pattern selection.

import { PATTERNS } from "./patterns.js";
import { state } from "./state.js";
import { mod } from "./utils.js";
import { updateUI } from "./ui.js";

export function getCurrentPattern() {
  return PATTERNS[state.patternIndex];
}

export function getPatternCenter(cells) {
  let maxRow = 0;
  let maxCol = 0;
  cells.forEach(([row, col]) => {
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  });
  return { x: Math.floor(maxCol / 2), y: Math.floor(maxRow / 2) };
}

export function getPatternOffsetCells(worldX, worldY) {
  const pattern = getCurrentPattern();
  if (!pattern.cells) return [];
  const center = getPatternCenter(pattern.cells);
  return pattern.cells.map(([row, col]) => [worldX + col - center.x, worldY + row - center.y]);
}

export function dedupeCells(cells) {
  const set = new Set();
  return cells.filter(([x, y]) => {
    const key = `${x},${y}`;
    if (set.has(key)) return false;
    set.add(key);
    return true;
  });
}

export function buildLineCells(start, end) {
  const cells = [];
  let x0 = start.x;
  let y0 = start.y;
  const x1 = end.x;
  const y1 = end.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    cells.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * error;
    if (e2 >= dy) { error += dy; x0 += sx; }
    if (e2 <= dx) { error += dx; y0 += sy; }
  }
  return cells;
}

export function buildBoxCells(start, end) {
  const cells = [];
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  for (let x = minX; x <= maxX; x += 1) cells.push([x, minY], [x, maxY]);
  for (let y = minY + 1; y < maxY; y += 1) cells.push([minX, y], [maxX, y]);
  return dedupeCells(cells);
}

export function buildCircleCells(start, end) {
  const radius = Math.max(1, Math.round(Math.hypot(end.x - start.x, end.y - start.y)));
  let x = radius;
  let y = 0;
  let error = 1 - x;
  const cells = [];
  while (x >= y) {
    cells.push(
      [start.x + x, start.y + y], [start.x + y, start.y + x],
      [start.x - y, start.y + x], [start.x - x, start.y + y],
      [start.x - x, start.y - y], [start.x - y, start.y - x],
      [start.x + y, start.y - x], [start.x + x, start.y - y],
    );
    y += 1;
    if (error < 0) error += 2 * y + 1;
    else { x -= 1; error += 2 * (y - x + 1); }
  }
  return dedupeCells(cells);
}

export function getToolCells(anchor, current) {
  switch (state.currentTool) {
    case "line": return buildLineCells(anchor, current);
    case "box": return buildBoxCells(anchor, current);
    case "circle": return buildCircleCells(anchor, current);
    case "stamp": return getPatternOffsetCells(current.x, current.y);
    default: return [[current.x, current.y]];
  }
}

export function setTool(toolId) {
  state.currentTool = toolId;
  if (toolId === "stamp" && !getCurrentPattern().cells) state.patternIndex = 1;
  if (toolId === "freehand") state.patternIndex = 0;
  updateUI();
}

export function selectPattern(index, forceStamp = false) {
  state.patternIndex = mod(index, PATTERNS.length);
  const pattern = getCurrentPattern();
  if (pattern.cells) {
    if (forceStamp || state.currentTool === "freehand") state.currentTool = "stamp";
  } else {
    state.currentTool = "freehand";
  }
  updateUI();
}
