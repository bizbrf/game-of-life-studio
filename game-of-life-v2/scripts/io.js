// RLE and JSON import/export.

import { PALETTES, THEMES } from "./constants.js";
import { state } from "./state.js";
import { keyFromXY, xyFromKey, cloneMapEntries } from "./utils.js";
import { applyRule, canonicalizeRule, compileRule } from "./rules.js";
import { setTheme, getTheme } from "./themes.js";
import { commitDiffFromMaps, pushSimulationSnapshot } from "./history.js";
import { normalizeWrappedCoord, normalizeKeyForState } from "./sim.js";

export function exportToJson() {
  return JSON.stringify({
    generation: state.generation,
    rule: state.rule,
    theme: getTheme().id,
    palette: state.paletteId,
    accent: state.accent,
    wrap: state.wrap,
    gridLines: state.gridLines,
    particles: state.particles,
    speed: state.speed,
    camera: {
      x: state.camera.x,
      y: state.camera.y,
      zoom: state.camera.zoom,
    },
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

function validateTheme(themeId) {
  if (themeId === undefined) return;
  if (!THEMES.some((theme) => theme.id === themeId)) {
    throw new Error("Invalid theme in JSON.");
  }
}

function validatePalette(paletteId) {
  if (paletteId === undefined) return;
  if (!Object.hasOwn(PALETTES, paletteId)) {
    throw new Error("Invalid palette in JSON.");
  }
}

function validateAccent(accent) {
  if (accent === undefined) return;
  if (typeof accent !== "string" || !/^#[0-9a-f]{6}$/i.test(accent)) {
    throw new Error("Invalid accent in JSON. Expected a #rrggbb hex color.");
  }
}

function validateSpeed(speed) {
  if (speed === undefined) return;
  if (speed === "max") return;
  if (!Number.isInteger(speed) || speed < 1 || speed > 60) {
    throw new Error("Invalid speed in JSON. Expected 1-60 or max.");
  }
}

function readBoolean(data, key, fallback) {
  if (data[key] === undefined) return fallback;
  if (typeof data[key] !== "boolean") throw new Error(`Invalid ${key} in JSON. Expected a boolean.`);
  return data[key];
}

function readCamera(camera) {
  if (camera === undefined) return state.camera;
  if (!camera || typeof camera !== "object" || Array.isArray(camera)) {
    throw new Error("Invalid camera in JSON. Expected finite x, y, and positive zoom.");
  }
  const { x, y, zoom } = camera;
  if (![x, y, zoom].every((value) => typeof value === "number" && Number.isFinite(value)) || zoom <= 0) {
    throw new Error("Invalid camera in JSON. Expected finite x, y, and positive zoom.");
  }
  return { x, y, zoom };
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.cells)) throw new Error("JSON must contain a cells array.");
  // Validate everything before touching state so a bad import leaves the
  // existing world intact. compileRule is pure (no state mutation), and
  // the rebuilt map rejects malformed keys/ages before render or sim can
  // consume them.
  if (data.rule && !compileRule(data.rule)) {
    throw new Error("Invalid rule. Use B/S notation like B3/S23.");
  }
  validateTheme(data.theme);
  validatePalette(data.palette);
  validateAccent(data.accent);
  validateSpeed(data.speed);
  const nextWrap = readBoolean(data, "wrap", state.wrap);
  const nextGridLines = readBoolean(data, "gridLines", state.gridLines);
  const nextParticles = readBoolean(data, "particles", state.particles);
  const nextCamera = readCamera(data.camera);
  const importedCells = new Map();
  for (let i = 0; i < data.cells.length; i += 1) {
    const entry = data.cells[i];
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || typeof entry[1] !== "number") {
      throw new Error(`Invalid cell entry at index ${i}. Expected [key, age].`);
    }
    const [key, age] = entry;
    if (!/^-?\d+,-?\d+$/.test(key) || !Number.isInteger(age) || age < 1) {
      throw new Error(`Invalid cell entry at index ${i}. Expected integer key and positive integer age.`);
    }
    const [x, y] = xyFromKey(key);
    const normalizedKey = nextWrap ? keyFromXY(...normalizeWrappedCoord(x, y)) : keyFromXY(x, y);
    importedCells.set(normalizedKey, Math.max(importedCells.get(normalizedKey) || 0, age));
  }
  let generation = 0;
  if (data.generation !== undefined) {
    const parsed = Number(data.generation);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("Invalid generation. Expected a non-negative integer.");
    }
    generation = parsed;
  }
  const before = new Map(state.liveCells);
  state.wrap = nextWrap;
  state.liveCells = importedCells;
  if (data.rule) applyRule(data.rule);
  if (data.theme) setTheme(data.theme, true);
  if (data.palette !== undefined) state.paletteId = data.palette;
  if (data.accent !== undefined) state.accent = data.accent.toLowerCase();
  else if (state.paletteId !== "custom") state.accent = getTheme().colors.accent;
  state.gridLines = nextGridLines;
  state.particles = nextParticles;
  if (data.speed !== undefined) state.speed = data.speed;
  state.camera = nextCamera;
  state.generation = generation;
  commitDiffFromMaps(before, state.liveCells, "Import JSON");
  state.populationHistory = [state.liveCells.size];
  state.simulationHistory = [];
  pushSimulationSnapshot();
}

export function importRle(text) {
  const parsed = parseRLE(text);
  // parsed.rule is the output of canonicalizeRule, which returns null on
  // invalid input. An empty string in the header also canonicalizes to null.
  // Validate here before mutating state so a bad header leaves the world intact.
  if (parsed.rule && !compileRule(parsed.rule)) {
    throw new Error("Invalid rule. Use B/S notation like B3/S23.");
  }
  const before = new Map(state.liveCells);
  state.liveCells.clear();
  const anchor = { x: Math.round(state.camera.x), y: Math.round(state.camera.y) };
  parsed.cells.forEach(([x, y]) => {
    state.liveCells.set(normalizeKeyForState(anchor.x + x, anchor.y + y), 1);
  });
  if (parsed.rule) applyRule(parsed.rule);
  commitDiffFromMaps(before, state.liveCells, "Import RLE");
  state.generation = 0;
  state.populationHistory = [state.liveCells.size];
  state.simulationHistory = [];
  pushSimulationSnapshot();
}
