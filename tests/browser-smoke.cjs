const { chromium } = require("playwright");

const appUrl = process.env.APP_URL || "http://127.0.0.1:8765/game-of-life-v2/index.html";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("#life-canvas");

    await page.keyboard.press("Control+K");
    await page.waitForSelector("#inspector.open");
    await page.waitForFunction(() => document.activeElement?.id === "inspector-close");

    await page.keyboard.press("Tab");
    assert(await page.evaluate(() => document.activeElement?.id !== "inspector-close"), "Tab should move focus inside the inspector.");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#inspector:not(.open)");

    await page.click("#speed-chip");
    await page.waitForSelector("#speed-popover.visible");
    const firstSpeedFocus = await page.evaluate(() => document.activeElement?.textContent);
    await page.keyboard.press("Tab");
    assert(await page.evaluate((first) => document.activeElement?.textContent !== first, firstSpeedFocus), "Tab should move through speed options.");
    await page.keyboard.press("Escape");

    await page.click("#status-rule");
    await page.waitForSelector("#rule-popover.visible");
    const firstRuleFocus = await page.evaluate(() => document.activeElement?.textContent);
    await page.keyboard.press("Tab");
    assert(await page.evaluate((first) => document.activeElement?.textContent !== first, firstRuleFocus), "Tab should move through rule options.");
    for (let i = 0; i < 4; i += 1) await page.keyboard.press("Tab");
    assert(await page.evaluate(() => document.activeElement?.matches("#rule-popover input")), "Custom rule input should be reachable by Tab.");
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const { state } = window.__gameOfLifeV2;
      state.liveCells = new Map([["49,0", 1], ["50,0", 1], ["51,0", 1]]);
      state.wrap = false;
      state.simulating = false;
    });
    await page.keyboard.press("W");
    const wrappedKeys = await page.evaluate(() => [...window.__gameOfLifeV2.state.liveCells.keys()]);
    assert(wrappedKeys.every((key) => {
      const [x, y] = key.split(",").map(Number);
      return x >= -50 && x <= 49 && y >= -50 && y <= 49;
    }), "Enabling wrap should canonicalize existing live cells.");

    const exportedJson = await page.evaluate(() => {
      const { state, exportToJson } = window.__gameOfLifeV2;
      state.liveCells = new Map([["1,2", 3]]);
      state.wrap = true;
      state.gridLines = true;
      state.particles = false;
      state.speed = 27;
      state.camera = { x: 4, y: -5, zoom: 1.5 };
      state.paletteId = "custom";
      state.accent = "#ff0000";
      return exportToJson();
    });
    await page.keyboard.press("Control+K");
    await page.waitForSelector("#inspector.open");
    await page.click("#io-btn");
    await page.fill("#import-text", exportedJson);
    await page.click("#import-json-btn");
    const roundTrip = await page.evaluate(() => {
      const { state } = window.__gameOfLifeV2;
      return {
        cellAge: state.liveCells.get("1,2"),
        wrap: state.wrap,
        gridLines: state.gridLines,
        particles: state.particles,
        speed: state.speed,
        camera: state.camera,
        paletteId: state.paletteId,
        accent: state.accent,
      };
    });
    assert(roundTrip.cellAge === 3, "JSON import should restore cell ages.");
    assert(roundTrip.wrap === true && roundTrip.gridLines === true && roundTrip.particles === false, "JSON import should restore behavior toggles.");
    assert(roundTrip.speed === 27, "JSON import should restore speed.");
    assert(roundTrip.camera.x === 4 && roundTrip.camera.y === -5 && roundTrip.camera.zoom === 1.5, "JSON import should restore camera.");
    assert(roundTrip.paletteId === "custom" && roundTrip.accent === "#ff0000", "JSON import should restore custom palette accent.");
    assert(errors.length === 0, `Console/page errors: ${errors.join(" | ")}`);

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    const mobileErrors = [];
    mobilePage.on("console", (message) => {
      if (message.type() === "error") mobileErrors.push(message.text());
    });
    mobilePage.on("pageerror", (error) => mobileErrors.push(error.message));
    await mobilePage.goto(appUrl, { waitUntil: "networkidle" });
    await mobilePage.click("#inspector-toggle");
    await mobilePage.waitForSelector("#inspector.open");
    const mobileChrome = await mobilePage.evaluate(() => {
      const status = document.querySelector(".status-strip").getBoundingClientRect();
      const playback = document.querySelector(".playback-pill").getBoundingClientRect();
      return {
        statusTop: status.top,
        playbackBottom: playback.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    assert(mobileChrome.statusTop >= 0, "Mobile inspector open should not scroll the status strip offscreen.");
    assert(mobileChrome.playbackBottom <= mobileChrome.viewportHeight, "Mobile inspector open should keep playback chrome in the viewport.");
    assert(mobileErrors.length === 0, `Mobile console/page errors: ${mobileErrors.join(" | ")}`);
    await mobileContext.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
