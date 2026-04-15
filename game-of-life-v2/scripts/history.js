// Undo/redo and simulation rewind history.

import { MAX_UNDO, MAX_REWIND, MAX_SPARKLINE_POINTS } from "./constants.js";
import { state } from "./state.js";
import { cloneMapEntries } from "./utils.js";

export function setCellAge(key, age) {
  if (age > 0) state.liveCells.set(key, age);
  else state.liveCells.delete(key);
}

export function pushPopulation(value) {
  state.populationHistory.push(value);
  if (state.populationHistory.length > MAX_SPARKLINE_POINTS) state.populationHistory.shift();
}

export function captureSnapshot() {
  return {
    generation: state.generation,
    liveCells: cloneMapEntries(state.liveCells),
    population: state.liveCells.size,
  };
}

export function pushSimulationSnapshot() {
  const snapshot = captureSnapshot();
  state.simulationHistory.push(snapshot);
  if (state.simulationHistory.length > MAX_REWIND) state.simulationHistory.shift();
  state.historyCursor = state.simulationHistory.length - 1;
  state.browsingHistory = false;
}

export function restoreSnapshot(snapshot, index) {
  state.liveCells = new Map(snapshot.liveCells);
  state.generation = snapshot.generation;
  state.browsingHistory = index !== state.simulationHistory.length - 1;
  state.historyCursor = index;
  pushPopulation(state.liveCells.size);
}

export function truncateHistoryToCursor() {
  state.simulationHistory = state.simulationHistory.slice(0, state.historyCursor + 1);
  const snapshot = state.simulationHistory[state.historyCursor];
  if (snapshot) {
    state.liveCells = new Map(snapshot.liveCells);
    state.generation = snapshot.generation;
  }
  state.browsingHistory = false;
  state.historyCursor = state.simulationHistory.length - 1;
}

export function pushUndoEntry(diff, label) {
  if (!diff.length) return;
  state.undoStack.push({ diff, label });
  if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
  state.redoStack.length = 0;
}

export function commitDiffFromMaps(beforeMap, afterMap, label) {
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const diff = [];
  keys.forEach((key) => {
    const before = beforeMap.get(key) || 0;
    const after = afterMap.get(key) || 0;
    if (before !== after) diff.push({ key, before, after });
  });
  if (!diff.length) return false;
  pushUndoEntry(diff, label);
  return true;
}

function applyUndoEntry(entry, direction) {
  entry.diff.forEach(({ key, before, after }) => {
    setCellAge(key, direction === "undo" ? before : after);
  });
  state.populationHistory = state.populationHistory
    .concat(state.liveCells.size)
    .slice(-MAX_SPARKLINE_POINTS);
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

// Returns { success: true } on success, { success: false, message } when the
// stack is empty. Callers (app.js) surface the message via showToast; keeps
// history.js from depending upward on ui.js.
export function undo() {
  const entry = state.undoStack.pop();
  if (!entry) return { success: false, message: "Nothing to undo." };
  applyUndoEntry(entry, "undo");
  state.redoStack.push(entry);
  return { success: true };
}

export function redo() {
  const entry = state.redoStack.pop();
  if (!entry) return { success: false, message: "Nothing to redo." };
  applyUndoEntry(entry, "redo");
  state.undoStack.push(entry);
  return { success: true };
}
