// Shared mutable state for the app. Populated at boot by app.js.
// Modules read/write these directly; the main loop drives UI sync.

import { RULESETS } from "./constants.js";

function buildParticles(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 2 + 0.8,
    speed: Math.random() * 0.015 + 0.006,
    drift: (Math.random() - 0.5) * 0.01,
    alpha: Math.random() * 0.25 + 0.08,
    // Populated by render.ensureParticleStyles on first draw (and on every
    // theme switch thereafter). Declared here so the particle shape is
    // self-documenting.
    fillStyle: "",
  }));
}

export const state = {
  liveCells: new Map(),
  fadingCells: new Map(),
  populationHistory: [0],
  generation: 0,
  speed: 15,
  simulating: false,
  accumulator: 0,
  lastFrameTime: performance.now(),
  fps: 0,
  frameCounter: 0,
  fpsTimer: 0,
  generationRate: 0,
  generationRateTimer: 0,
  generationRateSteps: 0,
  gridLines: false,
  wrap: false,
  particles: true,
  sound: false,
  showControls: true,
  currentTool: "freehand",
  patternIndex: 0,
  paletteId: "mono",
  accent: "#8d8fff",
  themeIndex: 0,
  hoverCell: null,
  camera: { x: 0, y: 0, zoom: 1 },
  interaction: null,
  simulationHistory: [],
  historyCursor: 0,
  browsingHistory: false,
  undoStack: [],
  redoStack: [],
  rule: RULESETS[0].rule,
  // Populated by app.js calling applyRule(state.rule) during initialize().
  // Left null here to avoid a state.js ↔ rules.js module-load cycle.
  rules: null,
  particlesState: buildParticles(28),
  modals: new Set(),
  inspectorOpen: false,
};

export const audioState = { context: null, humOscillator: null, humGain: null };

// Populated by app.js after DOMContentLoaded (ES modules are deferred).
export const els = {};

export const canvasRefs = {
  canvas: null,
  ctx: null,
  sparklineCanvas: null,
  sparkCtx: null,
};
