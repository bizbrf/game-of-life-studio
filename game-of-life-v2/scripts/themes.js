// Theme and palette state. DOM projection (writing CSS custom properties
// to document.documentElement) lives in ui.applyThemeToDOM so this module
// can stay out of the document/window API surface.

import { THEMES, PALETTES } from "./constants.js";
import { state } from "./state.js";
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
// array plus hexToRgb/rgbToHex ops per call to getPaletteColors.
// state.accent only changes on user interaction (accent picker input), but
// getPaletteColors is called every frame from drawCells.
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

// State-only: updates themeIndex, paletteId (unless silent), and the
// authoritative accent. The DOM projection (CSS variables, colorScheme,
// accent-picker element value) runs separately via ui.applyThemeToDOM —
// which every caller of setTheme should invoke before the next paint.
export function setTheme(themeId, silent = false) {
  const index = THEMES.findIndex((theme) => theme.id === themeId);
  if (index === -1) return;
  state.themeIndex = index;
  const theme = THEMES[index];
  if (!silent) {
    state.paletteId = theme.defaultPalette;
  }
  if (state.paletteId !== "custom") {
    state.accent = theme.colors.accent;
  }
}
