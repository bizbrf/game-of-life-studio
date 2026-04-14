# AGENTS.md

Rules and map for AI agents working in this repo. Humans should read [CONTRIBUTING.md](CONTRIBUTING.md) instead.

## What this is

Game of Life Studio — a polished, no-build web app for Conway's Game of Life and related cellular automata. Plain HTML + CSS + ES modules, hosted on GitHub Pages. The app is feature-complete; current work is UI polish, maintainability, and incremental features.

## Where to look

| Need | Go to |
|---|---|
| What each module does | [docs/agents/module-map.md](docs/agents/module-map.md) |
| How modules fit together | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Why a past decision was made | [docs/adr/](docs/adr/) |
| Narrative dev log | [docs/journal.md](docs/journal.md) |
| Earlier handoff context | [docs/handoffs/](docs/handoffs/) |
| When editing a folder | `AGENTS.md` inside that folder |

## Change protocol

Before editing:

1. Read the `AGENTS.md` in the folder you're editing (if one exists).
2. Check `docs/agents/module-map.md` to see what depends on the file you're touching.
3. If the change touches two or more modules, read [docs/agents/change-protocol.md](docs/agents/change-protocol.md).

While editing:

- **No new dependencies.** This is a no-build project. If you're tempted, open an ADR instead.
- **One responsibility per file.** Don't put render logic in `sim.js` or simulation logic in `render.js`.
- **`state.js` is the single store.** Do not create parallel state objects.
- **New architectural decisions require a new ADR** in `docs/adr/`. Do not bury the decision in a code comment.

After editing:

- Run the verification steps in [docs/agents/verification.md](docs/agents/verification.md). This is required, not optional.
- Append one entry to [docs/journal.md](docs/journal.md) with: what changed, what was verified, what still feels weak.
- If you changed module shapes, update [docs/agents/module-map.md](docs/agents/module-map.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Verification (required)

Static code edits alone are not enough. Every change must be exercised in a real browser.

```bash
# From repo root
python -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/game-of-life-v2/index.html> and:

- Exercise the feature you changed.
- Confirm no new console errors.
- Test both pointer and keyboard paths where relevant.
- For UI changes, save a screenshot to `docs/screenshots/` (ad-hoc dev screenshots go to `output/` which is gitignored).

Full protocol with Playwright setup: [docs/agents/verification.md](docs/agents/verification.md).

## Scope rules

Scope creep is the default failure mode. Stay in the lane the task named.

- A bug fix does not need surrounding refactor.
- A single-file change does not justify touching siblings "for consistency."
- If you find a second bug, file a journal entry or GitHub issue — do not fix it in the same pass.

## Commit and PR discipline

- One coherent change per commit. Commit messages describe **why**, not **what**.
- Feature branches: `feat/<short-name>`. Fixes: `fix/<short-name>`. Docs: `docs/<short-name>`.
- Never force-push `main`. Never skip hooks (`--no-verify`) without the human asking for it.
- When unsure, pause and ask.

## Current focus

Cycle D (code review of the 15-module split) has not started yet. The most recent deferred UI item is the custom select / popover replacement — see [docs/handoffs/2026-04-14-initial-handoff.md](docs/handoffs/2026-04-14-initial-handoff.md) for prior context.
