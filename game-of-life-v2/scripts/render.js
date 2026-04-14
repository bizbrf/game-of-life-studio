// Canvas rendering: cells, grid, particles, sparkline, pattern previews.

import { BASE_CELL_SIZE, WRAP_BOUNDS, MAX_SPARKLINE_POINTS } from "./constants.js";
import { state, canvasRefs } from "./state.js";
import { xyFromKey } from "./utils.js";
import { getTheme, getPaletteColors } from "./themes.js";
import { getCurrentPattern, getPatternOffsetCells, getToolCells } from "./tools.js";

export function ensureCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  const { canvas, ctx, sparklineCanvas, sparkCtx } = canvasRefs;
  const { clientWidth, clientHeight } = canvas;
  canvas.width = Math.max(1, Math.floor(clientWidth * dpr));
  canvas.height = Math.max(1, Math.floor(clientHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sparklineCanvas.width = Math.max(1, Math.floor(sparklineCanvas.clientWidth * dpr));
  sparklineCanvas.height = Math.max(1, Math.floor(sparklineCanvas.clientHeight * dpr));
  sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function worldToScreen(x, y) {
  const { canvas } = canvasRefs;
  const size = BASE_CELL_SIZE * state.camera.zoom;
  return {
    x: (x - state.camera.x) * size + canvas.clientWidth / 2,
    y: (y - state.camera.y) * size + canvas.clientHeight / 2,
  };
}

export function screenToWorld(clientX, clientY) {
  const { canvas } = canvasRefs;
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const size = BASE_CELL_SIZE * state.camera.zoom;
  return {
    x: Math.floor((localX - canvas.clientWidth / 2) / size + state.camera.x),
    y: Math.floor((localY - canvas.clientHeight / 2) / size + state.camera.y),
  };
}

export function visibleWorldBounds(padding = 3) {
  const { canvas } = canvasRefs;
  const size = BASE_CELL_SIZE * state.camera.zoom;
  const halfCols = canvas.clientWidth / (2 * size);
  const halfRows = canvas.clientHeight / (2 * size);
  return {
    minX: Math.floor(state.camera.x - halfCols) - padding,
    maxX: Math.ceil(state.camera.x + halfCols) + padding,
    minY: Math.floor(state.camera.y - halfRows) - padding,
    maxY: Math.ceil(state.camera.y + halfRows) + padding,
  };
}

export function drawRoundedRect(context, x, y, width, height, radius, fillStyle, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = fillStyle;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.fill();
  context.restore();
}

function drawBackgroundAtmosphere() {
  const { canvas, ctx } = canvasRefs;
  const theme = getTheme();
  const gradient = ctx.createLinearGradient(0, 0, canvas.clientWidth, canvas.clientHeight);
  gradient.addColorStop(0, theme.colors.bg);
  gradient.addColorStop(1, theme.colors.bg2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function drawParticles() {
  const { canvas, ctx } = canvasRefs;
  ctx.save();
  const accent = `rgba(${getTheme().colors.accentRgb},`;
  state.particlesState.forEach((particle) => {
    ctx.fillStyle = `${accent}${particle.alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x * canvas.clientWidth, particle.y * canvas.clientHeight, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawGrid() {
  const { canvas, ctx } = canvasRefs;
  const bounds = visibleWorldBounds(1);
  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim();
  ctx.lineWidth = Math.max(0.5, Math.min(1, state.camera.zoom * 0.8));
  ctx.beginPath();
  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    const pos = worldToScreen(x, bounds.minY);
    ctx.moveTo(Math.round(pos.x) + 0.5, 0);
    ctx.lineTo(Math.round(pos.x) + 0.5, canvas.clientHeight);
  }
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    const pos = worldToScreen(bounds.minX, y);
    ctx.moveTo(0, Math.round(pos.y) + 0.5);
    ctx.lineTo(canvas.clientWidth, Math.round(pos.y) + 0.5);
  }
  ctx.stroke();
  if (state.wrap) {
    const left = worldToScreen(-Math.floor(WRAP_BOUNDS.width / 2), -Math.floor(WRAP_BOUNDS.height / 2));
    const right = worldToScreen(Math.ceil(WRAP_BOUNDS.width / 2), Math.ceil(WRAP_BOUNDS.height / 2));
    ctx.strokeStyle = `rgba(${getTheme().colors.accentRgb}, 0.5)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(left.x, left.y, right.x - left.x, right.y - left.y);
  }
  ctx.restore();
}

function drawCells() {
  const { ctx } = canvasRefs;
  const palette = getPaletteColors();
  const cellSize = BASE_CELL_SIZE * state.camera.zoom;
  const size = Math.max(2, cellSize - 1);
  const radius = Math.max(2, Math.min(6, size * 0.2));
  const bounds = visibleWorldBounds(2);
  for (const [key, age] of state.liveCells.entries()) {
    const [x, y] = xyFromKey(key);
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
    const point = worldToScreen(x, y);
    const color = palette[Math.min(palette.length - 1, age - 1)];
    drawRoundedRect(ctx, point.x + 0.5, point.y + 0.5, size, size, radius, color, Math.min(1, 0.35 + age * 0.08));
  }
  for (const [key, fading] of state.fadingCells.entries()) {
    const [x, y] = xyFromKey(key);
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
    const point = worldToScreen(x, y);
    const color = palette[Math.min(palette.length - 1, Math.max(0, fading.age - 1))];
    drawRoundedRect(ctx, point.x + 0.5, point.y + 0.5, size, size, radius, color, Math.max(0, fading.alpha * 0.55));
  }
}

function getPreviewCells() {
  if (state.simulating || !state.hoverCell) return [];
  if (state.currentTool === "stamp" && getCurrentPattern().cells) {
    return getPatternOffsetCells(state.hoverCell.x, state.hoverCell.y);
  }
  if (["line", "box", "circle"].includes(state.currentTool) && state.interaction && state.interaction.start) {
    return getToolCells(state.interaction.start, state.hoverCell);
  }
  return [[state.hoverCell.x, state.hoverCell.y]];
}

function drawGhostPreview() {
  const { ctx } = canvasRefs;
  const previewCells = getPreviewCells();
  if (!previewCells.length) return;
  const pulse = 0.38 + Math.sin(performance.now() / 240) * 0.12;
  const cellSize = BASE_CELL_SIZE * state.camera.zoom;
  const size = Math.max(2, cellSize - 1);
  const radius = Math.max(2, Math.min(6, size * 0.2));
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  previewCells.forEach(([x, y]) => {
    const point = worldToScreen(x, y);
    drawRoundedRect(ctx, point.x + 0.5, point.y + 0.5, size, size, radius, accent, pulse);
  });
}

export function drawSparkline() {
  const { sparklineCanvas, sparkCtx } = canvasRefs;
  const width = sparklineCanvas.clientWidth;
  const height = sparklineCanvas.clientHeight;
  sparkCtx.clearRect(0, 0, width, height);
  if (state.populationHistory.length < 2) return;
  const values = state.populationHistory.slice(-MAX_SPARKLINE_POINTS);
  const max = Math.max(...values, 1);
  sparkCtx.strokeStyle = `rgba(${getTheme().colors.accentRgb}, 0.92)`;
  sparkCtx.lineWidth = 2;
  sparkCtx.beginPath();
  values.forEach((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    if (index === 0) sparkCtx.moveTo(x, y);
    else sparkCtx.lineTo(x, y);
  });
  sparkCtx.stroke();
  sparkCtx.fillStyle = `rgba(${getTheme().colors.accentRgb}, 0.12)`;
  sparkCtx.beginPath();
  sparkCtx.moveTo(0, height);
  values.forEach((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    sparkCtx.lineTo(x, y);
  });
  sparkCtx.lineTo(width, height);
  sparkCtx.closePath();
  sparkCtx.fill();
}

export function draw() {
  const { canvas, ctx } = canvasRefs;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawBackgroundAtmosphere();
  if (state.gridLines) drawGrid();
  if (state.particles) drawParticles();
  drawCells();
  drawGhostPreview();
}

export function updateParticles(dt) {
  if (!state.particles) return;
  state.particlesState.forEach((particle) => {
    particle.y -= particle.speed * dt * 60;
    particle.x += particle.drift * dt * 60;
    if (particle.y < -0.05) { particle.y = 1.05; particle.x = Math.random(); }
    if (particle.x < -0.05) particle.x = 1.05;
    if (particle.x > 1.05) particle.x = -0.05;
  });
}

export function drawPatternPreview(previewCanvas, pattern, accent) {
  const previewCtx = previewCanvas.getContext("2d");
  const width = previewCanvas.width;
  const height = previewCanvas.height;
  previewCtx.clearRect(0, 0, width, height);
  previewCtx.fillStyle = "rgba(255,255,255,0.02)";
  previewCtx.fillRect(0, 0, width, height);
  if (!pattern.cells) {
    previewCtx.fillStyle = accent;
    previewCtx.font = "600 13px system-ui";
    previewCtx.fillText("Freehand", 16, 40);
    return;
  }
  let maxRow = 0;
  let maxCol = 0;
  pattern.cells.forEach(([row, col]) => {
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  });
  const cellSize = Math.max(6, Math.min(16, Math.floor(Math.min(width / (maxCol + 3), height / (maxRow + 3)))));
  const offsetX = Math.floor((width - (maxCol + 1) * cellSize) / 2);
  const offsetY = Math.floor((height - (maxRow + 1) * cellSize) / 2);
  pattern.cells.forEach(([row, col]) => {
    drawRoundedRect(previewCtx, offsetX + col * cellSize, offsetY + row * cellSize, cellSize - 1, cellSize - 1, 3, accent, 0.92);
  });
}
