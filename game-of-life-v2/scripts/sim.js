// Simulation core: stepping, reset, random fill, neighbor counting, wrap.

import { WRAP_BOUNDS, RANDOM_FILL_DENSITY, MAX_SPARKLINE_POINTS } from "./constants.js";
import { state } from "./state.js";
import { keyFromXY, xyFromKey, mod } from "./utils.js";
import {
  pushSimulationSnapshot,
  pushPopulation,
  truncateHistoryToCursor,
  commitDiffFromMaps,
  pushUndoEntry,
} from "./history.js";
import { emitStepSound } from "./audio.js";
import { showToast } from "./ui.js";

export function normalizeWrappedCoord(x, y) {
  const minX = -Math.floor(WRAP_BOUNDS.width / 2);
  const minY = -Math.floor(WRAP_BOUNDS.height / 2);
  return [mod(x - minX, WRAP_BOUNDS.width) + minX, mod(y - minY, WRAP_BOUNDS.height) + minY];
}

export function normalizeKeyForState(x, y) {
  return state.wrap ? keyFromXY(...normalizeWrappedCoord(x, y)) : keyFromXY(x, y);
}

export function computeNeighborCountMap() {
  const counts = new Map();
  for (const key of state.liveCells.keys()) {
    const [x, y] = xyFromKey(key);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        let nx = x + dx;
        let ny = y + dy;
        if (state.wrap) [nx, ny] = normalizeWrappedCoord(nx, ny);
        const nKey = keyFromXY(nx, ny);
        counts.set(nKey, (counts.get(nKey) || 0) + 1);
      }
    }
  }
  return counts;
}

export function animateDeaths(deaths) {
  for (const [key, age] of deaths) state.fadingCells.set(key, { age, alpha: 1 });
}

export function updateFadeAnimations(dt) {
  const fadeRate = Math.max(0.01, dt * 6);
  for (const [key, data] of state.fadingCells.entries()) {
    data.alpha -= fadeRate;
    if (data.alpha <= 0) state.fadingCells.delete(key);
  }
}

export function stepSimulation() {
  if (state.browsingHistory && state.historyCursor !== state.simulationHistory.length - 1) {
    truncateHistoryToCursor();
  }
  const neighborCounts = computeNeighborCountMap();
  const nextCells = new Map();
  const births = [];
  const deaths = [];
  for (const [key, count] of neighborCounts.entries()) {
    const age = state.liveCells.get(key) || 0;
    if (age > 0) {
      if (state.rules.survive.has(count)) nextCells.set(key, age + 1);
      else deaths.push([key, age]);
    } else if (state.rules.birth.has(count)) {
      nextCells.set(key, 1);
      births.push(key);
    }
  }
  for (const [key, age] of state.liveCells.entries()) {
    if (!neighborCounts.has(key)) deaths.push([key, age]);
  }
  state.liveCells = nextCells;
  state.generation += 1;
  state.generationRateSteps += 1;
  animateDeaths(deaths);
  if (births.length) emitStepSound(births.length);
  pushPopulation(state.liveCells.size);
  pushSimulationSnapshot();
}

export function resetSimulation(pushUndo = true) {
  if (pushUndo) {
    const diff = [];
    for (const [key, age] of state.liveCells.entries()) diff.push({ key, before: age, after: 0 });
    pushUndoEntry(diff, "Reset world");
  }
  state.liveCells.clear();
  state.fadingCells.clear();
  state.generation = 0;
  state.simulating = false;
  state.accumulator = 0;
  state.populationHistory = [0];
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

// `visibleBounds` is what the user can see when wrap is off — passed in by
// the caller so sim.js doesn't need to import render (viewport is a UI
// concept, not a simulation one).
export function randomFill(visibleBounds) {
  const bounds = state.wrap
    ? {
        minX: -Math.floor(WRAP_BOUNDS.width / 2),
        maxX: Math.ceil(WRAP_BOUNDS.width / 2) - 1,
        minY: -Math.floor(WRAP_BOUNDS.height / 2),
        maxY: Math.ceil(WRAP_BOUNDS.height / 2) - 1,
      }
    : visibleBounds;
  const before = new Map(state.liveCells);
  state.liveCells.clear();
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (Math.random() < RANDOM_FILL_DENSITY) {
        state.liveCells.set(normalizeKeyForState(x, y), 1);
      }
    }
  }
  commitDiffFromMaps(before, state.liveCells, "Random fill");
  state.generation = 0;
  state.populationHistory = [state.liveCells.size];
  state.simulationHistory = [];
  pushSimulationSnapshot();
  showToast("Filled the active field at 25% density.");
}

export function addCells(cells, alive, label = "Edit", pushUndo = true, strokeBefore = null) {
  if (!cells.length) return;
  const fullBefore = pushUndo ? new Map(state.liveCells) : null;
  cells.forEach(([x, y]) => {
    const key = normalizeKeyForState(x, y);
    if (strokeBefore && !strokeBefore.has(key)) {
      strokeBefore.set(key, state.liveCells.get(key) || 0);
    }
    if (alive) state.liveCells.set(key, 1);
    else state.liveCells.delete(key);
  });
  if (!pushUndo) return;
  if (!commitDiffFromMaps(fullBefore, state.liveCells, label)) return;
  state.populationHistory = state.populationHistory
    .concat(state.liveCells.size)
    .slice(-MAX_SPARKLINE_POINTS);
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

// Commits only the user-touched keys recorded in strokeBefore, so a diff
// does not accidentally include simulation evolution that ran during the
// stroke. strokeBefore maps key → value-before-user-first-touched-it.
export function commitStroke(strokeBefore, label) {
  if (!strokeBefore || !strokeBefore.size) return;
  const diff = [];
  for (const [key, before] of strokeBefore.entries()) {
    const after = state.liveCells.get(key) || 0;
    if (before !== after) diff.push({ key, before, after });
  }
  if (!diff.length) return;
  pushUndoEntry(diff, label);
  state.populationHistory = state.populationHistory
    .concat(state.liveCells.size)
    .slice(-MAX_SPARKLINE_POINTS);
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

export function updateSimulation(dt) {
  updateFadeAnimations(dt);
  if (!state.simulating) return;
  state.accumulator += dt;
  const interval = state.speed === "max" ? 0 : 1 / state.speed;
  if (state.speed === "max") {
    stepSimulation();
    return;
  }
  while (state.accumulator >= interval) {
    stepSimulation();
    state.accumulator -= interval;
  }
}
