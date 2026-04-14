# Game of Life Studio

A polished web-based studio for Conway's Game of Life and related cellular automata. Infinite sparse grid, pattern library, custom rulesets, themes, and RLE import/export — runs in the browser with no install.

> **Status:** Active development. This README is a scaffold; full content is written in the documentation pass (cycle C of the current plan).

## Live demo

Once GitHub Pages is enabled: <https://bizbrf.github.io/game-of-life-studio/game-of-life-v2/>

## Running locally

No build step required.

```bash
# From the repo root
python -m http.server 8765 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8765/game-of-life-v2/index.html>.

## Features

- Sparse infinite grid (`Map<string, number>` backing store)
- Full-viewport canvas with infinite pan and zoom
- 13 classic patterns with live ghost preview
- Painting, erasing, and shape tools (line, box, circle)
- Undo / redo and generation rewind
- Configurable rulesets (Conway, HighLife, Seeds, and custom B/S notation)
- Light, dark, and additional themes
- RLE import / export
- Population sparkline
- Keyboard shortcuts and touch support

## Project structure

```
game-of-life-studio/
├── game-of-life-v2/        # The app (static HTML + CSS + JS modules)
│   ├── index.html
│   ├── styles/main.css
│   └── scripts/*.js        # 15 modules: sim, render, input, ui, ...
├── docs/
│   ├── screenshots/        # canonical app screenshots
│   ├── specs/              # implementation specs
│   └── superpowers/        # brainstorming specs + implementation plans
├── progress.md             # running dev log
└── CLAUDE-HANDOFF.md       # AI-agent handoff context (see AGENTS.md in cycle C)
```

## Tech

Plain HTML + CSS + ES modules. No build tooling, no framework, no dependencies. Canvas 2D for rendering.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
