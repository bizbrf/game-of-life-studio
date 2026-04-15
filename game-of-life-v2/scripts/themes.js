// Theme and palette handling.

import { THEMES, PALETTES } from "./constants.js";
import { state, els } from "./state.js";
import { hexToRgb, rgbToHex, mixColor } from "./utils.js";

export function getTheme() {
  return THEMES[state.themeIndex];
}

export function generateCustomPalette(accentHex) {
  const accent = hexToRgb(accentHex);
  const white = { r: 255, g: 255, b: 255 };
  const dark = {
    r: Math.max(16, accent.r * 0.3),
    g: Math.max(16, accent.g * 0.3),
    b: Math.max(16, accent.b * 0.3),
  };
  return Array.from({ length: 8 }, (_unused, index) => {
    const t = index / 7;
    const blended = t < 0.35
      ? mixColor(white, accent, t / 0.35)
      : mixColor(accent, dark, (t - 0.35) / 0.65);
    return rgbToHex(blended.r, blended.g, blended.b);
  });
}

// Custom-palette memoization: generateCustomPalette allocates an 8-element
// array plus hexToRgb/rgbToHex ops per cell. state.accent only changes on
// user interaction (accent picker input), but getPaletteColors is called
// every frame from drawCells.
let cachedCustomAccent = null;
let cachedCustomPalette = null;

export function getPaletteColors() {
  if (state.paletteId !== "custom") return PALETTES[state.paletteId].colors;
  if (state.accent !== cachedCustomAccent) {
    cachedCustomPalette = generateCustomPalette(state.accent);
    cachedCustomAccent = state.accent;
  }
  return cachedCustomPalette;
}

export function setTheme(themeId, silent = false) {
  const index = THEMES.findIndex((theme) => theme.id === themeId);
  if (index === -1) return;
  state.themeIndex = index;
  const theme = THEMES[index];
  const root = document.documentElement.style;
  root.setProperty("--bg", theme.colors.bg);
  root.setProperty("--bg-2", theme.colors.bg2);
  root.setProperty("--surface", theme.colors.surface);
  root.setProperty("--surface-strong", theme.colors.surfaceStrong);
  root.setProperty("--border", theme.colors.border);
  root.setProperty("--border-strong", theme.colors.borderStrong);
  root.setProperty("--text", theme.colors.text);
  root.setProperty("--text-dim", theme.colors.textDim);
  root.setProperty("--accent", theme.colors.accent);
  root.setProperty("--accent-rgb", theme.colors.accentRgb);
  root.setProperty("--ambient-a", theme.colors.ambientA);
  root.setProperty("--ambient-b", theme.colors.ambientB);
  root.setProperty("--grid-line", theme.colors.gridLine);
  root.setProperty("--success", theme.colors.success);
  root.setProperty("--danger", theme.colors.danger);
  document.documentElement.style.colorScheme = theme.mode;
  if (!silent) {
    state.paletteId = theme.defaultPalette;
  }
  if (state.paletteId !== "custom") {
    state.accent = theme.colors.accent;
    if (els.accentPicker) els.accentPicker.value = theme.colors.accent;
  }
}
