// RLE and JSON import/export.

import { state } from "./state.js";
import { keyFromXY, xyFromKey, cloneMapEntries } from "./utils.js";
import { applyRule, canonicalizeRule } from "./rules.js";
import { setTheme, getTheme } from "./themes.js";
import { commitDiffFromMaps, pushSimulationSnapshot } from "./history.js";
import { normalizeKeyForState } from "./sim.js";

export function exportToJson() {
  return JSON.stringify({
    generation: state.generation,
    rule: state.rule,
    theme: getTheme().id,
    palette: state.paletteId,
    cells: cloneMapEntries(state.liveCells),
  }, null, 2);
}

export function exportToRle() {
  if (!state.liveCells.size) return `x = 0, y = 0, rule = ${state.rule}\n!`;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const key of state.liveCells.keys()) {
    const [x, y] = xyFromKey(key);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const rows = [];
  for (let y = minY; y <= maxY; y += 1) {
    let row = "";
    let runCount = 0;
    let runChar = null;
    for (let x = minX; x <= maxX; x += 1) {
      const char = state.liveCells.has(keyFromXY(x, y)) ? "o" : "b";
      if (char === runChar) runCount += 1;
      else {
        if (runChar) row += `${runCount > 1 ? runCount : ""}${runChar}`;
        runChar = char;
        runCount = 1;
      }
    }
    if (runChar) row += `${runCount > 1 ? runCount : ""}${runChar}`;
    rows.push(row.replace(/b+$/, ""));
  }
  return `x = ${maxX - minX + 1}, y = ${maxY - minY + 1}, rule = ${state.rule}\n${rows.join("$")}!`;
}

export function parseRLE(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const header = lines.shift();
  if (!header) throw new Error("Missing RLE header.");
  const match = /x\s*=\s*(\d+),\s*y\s*=\s*(\d+)(?:,\s*rule\s*=\s*([Bb]\d*\/[Ss]\d*))?/i.exec(header);
  if (!match) throw new Error("Invalid RLE header.");
  const body = lines.join("");
  const cells = [];
  let x = 0;
  let y = 0;
  let run = "";
  for (const char of body) {
    if (/\d/.test(char)) { run += char; continue; }
    const count = run ? Number(run) : 1;
    run = "";
    if (char === "b") x += count;
    else if (char === "o") {
      for (let i = 0; i < count; i += 1) cells.push([x + i, y]);
      x += count;
    }
    else if (char === "$") { y += count; x = 0; }
    else if (char === "!") break;
  }
  return { cells, rule: canonicalizeRule(match[3] || "") };
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.cells)) throw new Error("JSON must contain a cells array.");
  const before = new Map(state.liveCells);
  state.liveCells = new Map(data.cells);
  if (data.rule) {
    const result = applyRule(data.rule);
    if (!result.success) throw new Error(result.message);
  }
  if (data.theme) setTheme(data.theme, true);
  state.generation = Number(data.generation) || 0;
  commitDiffFromMaps(before, state.liveCells, "Import JSON");
  state.populationHistory = [state.liveCells.size];
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

export function importRle(text) {
  const parsed = parseRLE(text);
  const before = new Map(state.liveCells);
  state.liveCells.clear();
  const anchor = { x: Math.round(state.camera.x), y: Math.round(state.camera.y) };
  parsed.cells.forEach(([x, y]) => {
    state.liveCells.set(normalizeKeyForState(anchor.x + x, anchor.y + y), 1);
  });
  if (parsed.rule) {
    const result = applyRule(parsed.rule);
    if (!result.success) throw new Error(result.message);
  }
  commitDiffFromMaps(before, state.liveCells, "Import RLE");
  state.generation = 0;
  state.populationHistory = [state.liveCells.size];
  state.simulationHistory = [];
  pushSimulationSnapshot();
}
