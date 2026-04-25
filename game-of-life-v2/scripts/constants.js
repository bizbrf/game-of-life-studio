// Numeric and tabular constants used across the app.

export const BASE_CELL_SIZE = 12;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5.5;
export const MAX_UNDO = 120;
export const MAX_REWIND = 80;
export const MAX_SPARKLINE_POINTS = 200;
export const RANDOM_FILL_DENSITY = 0.25;
export const WRAP_BOUNDS = { width: 98, height: 80 };

export const SPEED_PRESETS = [
  { id: "slow", label: "Slow", value: 5 },
  { id: "normal", label: "Normal", value: 15 },
  { id: "fast", label: "Fast", value: 30 },
  { id: "turbo", label: "Turbo", value: 60 },
  { id: "max", label: "Max", value: "max" },
];

export const TOOL_ORDER = [
  { id: "freehand", label: "Freehand" },
  { id: "eraser", label: "Eraser" },
  { id: "stamp", label: "Stamp" },
  { id: "line", label: "Line" },
  { id: "box", label: "Box" },
  { id: "circle", label: "Circle" },
];

export const RULESETS = [
  { label: "Conway", rule: "B3/S23", description: "Balanced growth with gliders, still lifes, and oscillators." },
  { label: "HighLife", rule: "B36/S23", description: "Conway-like behavior with extra replication from birth on six neighbors." },
  { label: "Day & Night", rule: "B3678/S34678", description: "Dense inverse-symmetric worlds where empty and full regions echo each other." },
  { label: "Seeds", rule: "B2/S", description: "Explosive patterns where every live cell dies each generation." },
  { label: "Life without Death", rule: "B3/S012345678", description: "Growth-only worlds where live cells never die." },
];

export const PALETTES = {
  mono: { label: "Mono", colors: ["#ffffff", "#ececf7", "#d8d9eb", "#c1c2d7", "#aaabbe", "#8d8fa3", "#717488", "#5a5d71"] },
  ocean: { label: "Ocean", colors: ["#dffcff", "#b8f1ff", "#7bdfff", "#52ccff", "#2ca9f5", "#177ed2", "#135ba6", "#0f3d78"] },
  ember: { label: "Ember", colors: ["#fff3cb", "#ffe38c", "#ffc55a", "#ff9f38", "#ff6d2c", "#eb4a22", "#b92a1f", "#7a1618"] },
  aurora: { label: "Aurora", colors: ["#defef0", "#9cf7d9", "#63eac5", "#32cdb7", "#3ca3c9", "#536dd1", "#6d48bb", "#41256f"] },
  custom: { label: "Custom Accent", colors: [] },
};

export const THEMES = [
  { id: "obsidian", name: "Obsidian", mode: "dark", defaultPalette: "mono", colors: { bg: "#090b12", bg2: "#151a28", surface: "rgba(18, 22, 34, 0.72)", surfaceStrong: "rgba(25, 30, 46, 0.84)", border: "rgba(255,255,255,0.1)", borderStrong: "rgba(255,255,255,0.16)", text: "rgba(245,247,255,0.94)", textDim: "rgba(205,214,234,0.64)", accent: "#8d8fff", accentRgb: "141, 143, 255", ambientA: "rgba(141, 143, 255, 0.18)", ambientB: "rgba(117, 215, 255, 0.12)", gridLine: "rgba(255,255,255,0.07)", success: "#83f4c3", danger: "#ff8f9b" } },
  { id: "ivory", name: "Ivory", mode: "light", defaultPalette: "ocean", colors: { bg: "#f8f6ef", bg2: "#ece7db", surface: "rgba(255,255,255,0.68)", surfaceStrong: "rgba(255,255,255,0.82)", border: "rgba(35,42,58,0.12)", borderStrong: "rgba(35,42,58,0.18)", text: "rgba(28,34,44,0.94)", textDim: "rgba(55,63,74,0.58)", accent: "#3b82f6", accentRgb: "59, 130, 246", ambientA: "rgba(59, 130, 246, 0.12)", ambientB: "rgba(13, 148, 136, 0.12)", gridLine: "rgba(24,32,42,0.08)", success: "#16a34a", danger: "#dc2626" } },
  { id: "terminal", name: "Terminal", mode: "dark", defaultPalette: "aurora", colors: { bg: "#020703", bg2: "#051109", surface: "rgba(0,14,4,0.76)", surfaceStrong: "rgba(2,20,6,0.88)", border: "rgba(77,255,145,0.16)", borderStrong: "rgba(77,255,145,0.24)", text: "rgba(153,255,187,0.92)", textDim: "rgba(91,164,107,0.66)", accent: "#34d66b", accentRgb: "52, 214, 107", ambientA: "rgba(52,214,107,0.14)", ambientB: "rgba(21,128,61,0.12)", gridLine: "rgba(52,214,107,0.1)", success: "#5aff9f", danger: "#eb5757" } },
  { id: "cosmos", name: "Cosmos", mode: "dark", defaultPalette: "ember", colors: { bg: "#0b1024", bg2: "#19173a", surface: "rgba(17,21,41,0.74)", surfaceStrong: "rgba(25,30,58,0.86)", border: "rgba(255,225,166,0.14)", borderStrong: "rgba(255,225,166,0.22)", text: "rgba(245,238,255,0.94)", textDim: "rgba(203,194,235,0.62)", accent: "#f7c76d", accentRgb: "247, 199, 109", ambientA: "rgba(247,199,109,0.14)", ambientB: "rgba(143,102,255,0.12)", gridLine: "rgba(231,213,255,0.08)", success: "#c7f59d", danger: "#f0848c" } },
];
