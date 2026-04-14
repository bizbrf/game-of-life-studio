# Verification

Static code edits are not enough. Every meaningful change must be exercised in a real browser. This protocol is mandatory.

## Minimum (every change)

1. Start the local server from the repo root:

   ```bash
   python -m http.server 8765 --bind 127.0.0.1
   ```

2. Open the app:

   <http://127.0.0.1:8765/game-of-life-v2/index.html>

3. Exercise the feature you changed. Cover both the golden path and at least one edge case.

4. Open DevTools → Console. Confirm no new errors or warnings.

5. Test both pointer and keyboard paths where relevant.

## Smoke check (broader changes)

Run this after any non-trivial change to confirm you didn't regress the core loop:

- Play / pause simulation
- Step one generation manually
- Paint a cell, erase a cell
- Stamp a pattern from the library
- Pan, zoom in, zoom out
- Undo, redo
- Change ruleset
- Change theme
- Open I/O modal — export RLE, import back
- Open help modal
- No console errors at any point

## UI changes

If the change is visual:

- Save a before/after screenshot pair in `docs/screenshots/` if the change is permanent and representative.
- Ad-hoc exploratory screenshots go in `output/` (gitignored).
- Test light and dark themes — do not ship a UI that only works in one.
- Test at a small viewport — the mobile layout matters.

## Headless verification (Playwright)

For non-trivial flows, use a headless browser to script the check. The app exposes three globals for exactly this:

| Global | Purpose |
|---|---|
| `window.render_game_to_text()` | Returns a JSON snapshot of visible state. |
| `window.advanceTime(ms)` | Advances the sim loop manually — deterministic. |
| `window.__gameOfLifeV2` | Access to `state`, `exportToJson`, `exportToRle`. |

### Setup (one-time)

Previously run from `%TEMP%\gol-ui-check`. If that still exists, reuse it. Otherwise:

```bash
mkdir -p "$TEMP/gol-ui-check"
cd "$TEMP/gol-ui-check"
npm init -y
npm install playwright@1.59.1
npx playwright install chromium
```

### Typical check

```javascript
// check.mjs
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://127.0.0.1:8765/game-of-life-v2/index.html");
await page.waitForFunction(() => !!window.__gameOfLifeV2);

// advance 500ms of simulation time deterministically
await page.evaluate(() => window.advanceTime(500));

const snapshot = await page.evaluate(() => window.render_game_to_text());
console.log(snapshot);

await page.screenshot({ path: "output/check.png" });
await browser.close();
```

## Verification checklist per change type

| Change type | Required |
|---|---|
| Simulation logic (`sim.js`, `rules.js`, `history.js`) | Smoke check + at least one deterministic headless run |
| Rendering (`render.js`) | Smoke check + before/after screenshot |
| Input (`input.js`) | Exercise pointer, touch (if on a touchscreen or emulator), and keyboard paths |
| UI (`ui.js`, `styles/`) | Smoke check + before/after screenshot + light/dark theme check |
| I/O (`io.js`) | Round-trip export → import → export; diff the two exports |
| Docs or ADRs | Markdown renders correctly on GitHub |

## When verification fails

- **Do not mark the change complete.** Say so explicitly in the journal or PR.
- Investigate the root cause. Do not add `try/catch` to hide errors.
- If the failure is unrelated to your change, file a separate issue and note it in the journal.
