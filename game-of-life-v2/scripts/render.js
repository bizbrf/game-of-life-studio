// Canvas rendering: cells, grid, particles, sparkline, pattern previews.

import { BASE_CELL_SIZE, WRAP_BOUNDS, MAX_SPARKLINE_POINTS } from "./constants.js";
import { state, canvasRefs } from "./state.js";
import { xyFromKey } from "./utils.js";
import { getTheme, getPaletteColors } from "./themes.js";
import { getCurrentPattern, getPatternOffsetCells, getToolCells } from "./tools.js";

// dpr comes from the caller (app.js / ui.js) — render.js stays out of
// the window API surface, consistent with the ARCHITECTURE invariant
// that keeps document/window access in app.js and ui.js only.
export function ensureCanvasSize(dpr = 1) {
  const { canvas, ctx, sparklineCanvas, sparkCtx } = canvasRefs;
  const { clientWidth, clientHeight } = canvas;
  // Writing to canvas.width / .height resets the 2D context state (including
  // the DPR transform) even when the assigned value is unchanged. Guard
  // behind a change check so the idempotent case — the common one, since
  // this function is called every window resize and from the RAF-ish paths —
  // doesn't trigger a wasted context reset.
  const targetW = Math.max(1, Math.floor(clientWidth * dpr));
  const targetH = Math.max(1, Math.floor(clientHeight * dpr));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // Skip the sparkline resize while its popover is hidden (clientW/H === 0):
  // writing 0 to canvas.width would wipe the DPR transform, and clamping to 1
  // leaves a 1×1 backing store in place once the popover becomes visible.
  // Re-sizing happens either on the next window resize while visible or via
  // showSparklinePopover() which calls ensureCanvasSize again.
  if (sparklineCanvas.clientWidth > 0 && sparklineCanvas.clientHeight > 0) {
    const spkTargetW = Math.floor(sparklineCanvas.clientWidth * dpr);
    const spkTargetH = Math.floor(sparklineCanvas.clientHeight * dpr);
    if (sparklineCanvas.width !== spkTargetW || sparklineCanvas.height !== spkTargetH) {
      sparklineCanvas.width = spkTargetW;
      sparklineCanvas.height = spkTargetH;
      sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
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

// Single-cell rounded-rect. Kept for external callers like drawPatternPreview
// that only fill one cell per call. The main draw loop (drawCells /
// drawGhostPreview) uses the bucketed path below to amortize save/restore
// and fillStyle writes across many cells.
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

// Append the path for a rounded rect to the current ctx path without
// touching fillStyle, globalAlpha, save/restore, or fill. Used by the
// bucketed drawCells / drawGhostPreview paths to build one compound path
// per color+alpha bucket.
function addRoundedRectPath(context, x, y, width, height, radius) {
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

// Background gradient cache — keyed by (themeId, width, height). Theme
// switches and canvas resizes are the only real invalidation triggers;
// without the cache we allocated a new gradient + 2 colorstops every frame.
let cachedBgGradient = null;
let cachedBgGradientKey = "";

function drawBackgroundAtmosphere() {
  const { canvas, ctx } = canvasRefs;
  const theme = getTheme();
  // Guard against a zero-extent canvas (e.g. display:none briefly during
  // initial layout). createLinearGradient(0,0,0,0) is degenerate and fills
  // with the first colorstop's color only; caching it would poison the cache
  // until the next theme switch or resize.
  if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
    ctx.fillStyle = theme.colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const key = `${theme.id}|${canvas.clientWidth}|${canvas.clientHeight}`;
  if (key !== cachedBgGradientKey || !cachedBgGradient) {
    cachedBgGradient = ctx.createLinearGradient(0, 0, canvas.clientWidth, canvas.clientHeight);
    cachedBgGradient.addColorStop(0, theme.colors.bg);
    cachedBgGradient.addColorStop(1, theme.colors.bg2);
    cachedBgGradientKey = key;
  }
  ctx.fillStyle = cachedBgGradient;
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

// Particle fillStyle strings are cached on the particle itself (one per
// particle — their alphas are fixed at build time) and rebuilt when the
// theme changes. Without the cache each of 28 particles allocated a fresh
// `rgba(r,g,b,a)` template literal every frame.
// Intentional: the cache key is theme id only, NOT state.accent. Particles
// tint from the theme's built-in accentRgb, not from the user's custom
// accent picker value — a pre-existing behavior preserved here. If a future
// PR wants particles to follow the picker, widen this key to include the
// picker's rgb triple.
let particlesCacheThemeId = null;

function ensureParticleStyles(themeId) {
  if (themeId === particlesCacheThemeId) return;
  const accentRgb = getTheme().colors.accentRgb;
  state.particlesState.forEach((particle) => {
    particle.fillStyle = `rgba(${accentRgb},${particle.alpha})`;
  });
  particlesCacheThemeId = themeId;
}

function drawParticles() {
  const { canvas, ctx } = canvasRefs;
  ensureParticleStyles(getTheme().id);
  ctx.save();
  state.particlesState.forEach((particle) => {
    ctx.fillStyle = particle.fillStyle;
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
  // Read the grid-line color from the active theme rather than round-tripping
  // through getComputedStyle each frame — setTheme already stores the canonical
  // value on theme.colors.gridLine and pushes it to --grid-line for CSS.
  ctx.strokeStyle = getTheme().colors.gridLine;
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

  // Bucket cells by (color, alpha) so we can emit one compound path +
  // one fill per bucket instead of per-cell save/restore. For live cells
  // the mapping age → (colorIndex, alpha) is deterministic (see alpha
  // formula below), so bucketing by age is equivalent — except ages past
  // the saturation point (palette maxes out at palette.length, alpha
  // clamps at 1) all render identically and should share one bucket.
  // For fading cells alpha is continuous, so we quantize to 0.05 steps.
  const liveByAge = new Map();
  const saturatedColorIdx = palette.length - 1;
  for (const [key, age] of state.liveCells.entries()) {
    const [x, y] = xyFromKey(key);
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
    const point = worldToScreen(x, y);
    const colorIdx = Math.min(saturatedColorIdx, age - 1);
    const alpha = Math.min(1, 0.35 + age * 0.08);
    // Canonical key: collapse all ages ≥ palette.length into a single "max"
    // bucket because they produce identical pixels.
    const bucketKey = alpha >= 1 && colorIdx === saturatedColorIdx ? "max" : age;
    let bucket = liveByAge.get(bucketKey);
    if (!bucket) {
      bucket = { color: palette[colorIdx], alpha, points: [] };
      liveByAge.set(bucketKey, bucket);
    }
    bucket.points.push(point);
  }

  const fadeBuckets = new Map();
  for (const [key, fading] of state.fadingCells.entries()) {
    const [x, y] = xyFromKey(key);
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
    const alphaExact = Math.max(0, fading.alpha * 0.55);
    if (alphaExact <= 0) continue;
    const point = worldToScreen(x, y);
    const colorIdx = Math.min(palette.length - 1, Math.max(0, fading.age - 1));
    // 0.05 quantization → at most 21 alpha tiers (0..20 inclusive) per color,
    // so worst-case 21 × palette.length buckets. In practice fades clear in
    // < 0.5s so bucket count is much smaller. Numeric integer key avoids
    // per-cell template-literal string allocation in the hot path; 32 is a
    // safe stride since alphaTier ∈ [0, 20].
    const alphaTier = Math.round(alphaExact * 20);
    const bucketKey = colorIdx * 32 + alphaTier;
    let bucket = fadeBuckets.get(bucketKey);
    if (!bucket) {
      bucket = { color: palette[colorIdx], alpha: alphaTier / 20, points: [] };
      fadeBuckets.set(bucketKey, bucket);
    }
    bucket.points.push(point);
  }

  ctx.save();
  const flush = (bucket) => {
    ctx.globalAlpha = bucket.alpha;
    ctx.fillStyle = bucket.color;
    ctx.beginPath();
    for (const point of bucket.points) {
      addRoundedRectPath(ctx, point.x + 0.5, point.y + 0.5, size, size, radius);
    }
    ctx.fill();
  };
  for (const bucket of liveByAge.values()) flush(bucket);
  for (const bucket of fadeBuckets.values()) flush(bucket);
  ctx.restore();
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
  // Same reasoning as drawGrid: skip the getComputedStyle round-trip.
  // state.accent is the authoritative accent when the user has set a custom
  // palette; otherwise fall back to the theme's default accent.
  const accent = state.paletteId === "custom" ? state.accent : getTheme().colors.accent;
  // One color, one alpha — batch all ghost cells into a single path + fill.
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = accent;
  ctx.beginPath();
  previewCells.forEach(([x, y]) => {
    const point = worldToScreen(x, y);
    addRoundedRectPath(ctx, point.x + 0.5, point.y + 0.5, size, size, radius);
  });
  ctx.fill();
  ctx.restore();
}

export function drawSparkline() {
  const { sparklineCanvas, sparkCtx } = canvasRefs;
  const width = sparklineCanvas.clientWidth;
  const height = sparklineCanvas.clientHeight;
  sparkCtx.clearRect(0, 0, width, height);
  if (state.populationHistory.length < 2) return;
  const values = state.populationHistory.slice(-MAX_SPARKLINE_POINTS);
  // Manual max loop — avoids spreading a 200-element array into function
  // arguments (Math.max slow path on V8).
  let max = 1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > max) max = values[i];
  }
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
