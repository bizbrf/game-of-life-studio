# Design: AI-agent framework + documentation

**Date:** 2026-04-14
**Status:** Accepted
**Cycle:** C (of A→B→C→D cleanup/setup plan)

## Problem

The project has been refactored from a single `index.html` into 15 JavaScript modules plus CSS, docs, and planning artefacts. The user's concern is concrete:

> "An AI agent doesn't mix everything up or forget something that's in a different file. Now that it's split up across multiple sections, we'll need a better framework for handling that."

In addition, the repo lacks standard open-source documentation (README body, CHANGELOG, ARCHITECTURE, LICENSE was done in cycle B). The handoff context lives in an ad-hoc `CLAUDE-HANDOFF.md` and a running `progress.md` journal.

## Goals

1. An AI agent opening the repo cold should know within 30 seconds: what this is, where to look, what rules apply.
2. An AI agent editing one module should know without reading other modules: what that module owns, what its dependencies are, what changes require coordination.
3. The framework must work across sessions — durable state that survives an agent's context reset.
4. The human-facing documentation should match the polish of the app (Apple HIG / Linear-style restraint; no bureaucracy).
5. Solo-dev friendly. No process that slows down iteration.

## Non-goals

- Full engineering-team documentation (runbooks, on-call, API contracts). Overkill for this project.
- Generated API reference (JSDoc / TypeDoc). Modules are small and self-evident; a hand-written architecture doc is better value.
- GitHub Actions / CI. Deferred until the project has automated tests worth running.

## Design

### File layout

```
AGENTS.md                        # Root — single source of truth for agents
CHANGELOG.md                     # Keep-a-changelog format; empty until v0.1.0
ARCHITECTURE.md                  # 15-module overview, data flow, invariants
docs/
  agents/
    module-map.md                # One-line summary per module + dependency table
    change-protocol.md           # "When editing X, also check Y" rules
    verification.md              # Browser-testing playbook
  adr/
    0001-sparse-grid-map.md
    0002-no-build-no-framework.md
    0003-module-split-boundaries.md
    README.md                    # ADR index + template
  journal.md                     # Renamed from progress.md
  handoffs/
    2026-04-14-initial-handoff.md  # Archived CLAUDE-HANDOFF.md
game-of-life-v2/
  scripts/AGENTS.md              # Per-folder rules for JS modules
  styles/AGENTS.md               # CSS conventions
```

### Documents to remove or rename

- `CLAUDE-HANDOFF.md` → delete from root; archived copy at `docs/handoffs/2026-04-14-initial-handoff.md`. Durable rules folded into `AGENTS.md`.
- `progress.md` → move to `docs/journal.md`. Content unchanged.
- `README.md` → expanded from scaffold to full content (features, shortcuts, architecture link, screenshots).

### `AGENTS.md` structure (root)

The file is a contract, not a tutorial. Short, scannable, bullet-dense.

```markdown
# AGENTS.md

## What this is
<one paragraph>

## Where to look
- Module map → docs/agents/module-map.md
- Architecture → ARCHITECTURE.md
- Decisions → docs/adr/
- Current dev log → docs/journal.md
- Most recent active focus → <one-line status>

## Change protocol
- Before editing a folder, read its local AGENTS.md
- Cross-module changes require updating ARCHITECTURE.md if interfaces shift
- New architectural decisions → new ADR in docs/adr/
- Never add dependencies. This is a no-build project.

## Verification (required, not optional)
- Start a local server: `python -m http.server 8765 --bind 127.0.0.1`
- Open http://127.0.0.1:8765/game-of-life-v2/index.html
- Exercise the feature you changed; confirm no console errors
- If the change is visual, add a screenshot to docs/screenshots/

## Playwright smoke test
<commands that exist for headless verification>

## Journal
After a meaningful pass, append one entry to docs/journal.md with:
- what changed
- what was verified
- what still feels weak
```

### Per-folder `AGENTS.md` structure

Each is 15–30 lines. Four questions:
1. What does this folder own?
2. What belongs here? What doesn't?
3. What depends on me? Who do I depend on?
4. Common mistakes to avoid.

Example skeleton (`game-of-life-v2/scripts/AGENTS.md`):

```markdown
# scripts/ — simulation, rendering, and UI logic

## Responsibility
Plain ES modules. One responsibility per file.

## Modules
- sim.js — simulation step, neighbour counts, wrap
- render.js — canvas drawing, sparkline, ghost preview
- input.js — pointer, touch, keyboard
- ui.js — DOM wiring for toolbar + panels
- ...

## Rules
- No render logic in sim.js. No sim logic in render.js.
- state.js is the shared store; do not create parallel state objects.
- No dependencies. If you're reaching for one, open an ADR instead.

## Change protocol
- If you change sim.js's public shape, update ARCHITECTURE.md.
- If you add a new module, add it to docs/agents/module-map.md.
```

### ADR template

One page each. Fixed sections:
- **Context** — what problem, what constraints, what was tried
- **Decision** — what we chose, in one or two sentences
- **Consequences** — upsides, downsides, what this closes off
- **Status** — Proposed | Accepted | Superseded by <n>

ADRs are append-only. Superseding an old decision means writing a new ADR that references the old one; the old one stays as-is with its status updated.

Initial seed ADRs (3):
1. **Sparse grid as `Map<string, number>`** — Context: infinite grid, most cells empty. Decision: sparse map keyed by "x,y". Consequences: trivial infinite pan, worse cache locality than dense arrays, negligible at current scale.
2. **No build, no framework** — Context: simple deliverable, want to host on GitHub Pages with zero config. Decision: plain HTML/CSS/ES modules, no bundler, no framework. Consequences: instant iteration, no dependency surface, no tree-shaking — have to keep modules tight manually.
3. **Module split boundaries** — Context: single-file app became unmaintainable. Decision: 15 modules split by lifecycle concern (state, sim, render, input, ui, history, io, themes, patterns, tools, audio, rules, constants, utils, app). Consequences: clearer ownership, more files to hold in head, enforced by per-folder AGENTS.md.

### Journal vs CHANGELOG split

- **`docs/journal.md`** — narrative dev log. Current `progress.md` moves here unchanged. One entry per meaningful pass. Informal voice preserved.
- **`CHANGELOG.md`** — [keep-a-changelog](https://keepachangelog.com/) format. One entry per release. Populated at tag time (cycle D will cut v0.1.0). Until then: contains only an `## [Unreleased]` section.

### README.md expansion

From current scaffold to full content:
- Hero screenshot (`docs/screenshots/running.png`)
- One-line pitch + badges (license, pages status)
- Live demo link
- Features (grouped, not flat)
- Keyboard shortcuts table
- Running locally (already there)
- Architecture link (→ `ARCHITECTURE.md`)
- Contributing pointer
- License

## Implementation order

Each pass is an atomic commit.

1. Write `AGENTS.md` (root) by distilling `CLAUDE-HANDOFF.md`
2. Write per-folder `AGENTS.md` (`scripts/`, `styles/`)
3. Inspect the 15 modules to write accurate `ARCHITECTURE.md` + `docs/agents/module-map.md`
4. Write `docs/agents/change-protocol.md` + `docs/agents/verification.md`
5. Seed `docs/adr/` with 3 ADRs + index
6. Archive `CLAUDE-HANDOFF.md` → `docs/handoffs/` and delete from root
7. Move `progress.md` → `docs/journal.md`
8. Create empty `CHANGELOG.md` (Unreleased section only)
9. Expand `README.md` to full content
10. Push all commits

## Success criteria

- A fresh agent can read `AGENTS.md` + the relevant per-folder `AGENTS.md` and make a localised change without reading unrelated modules.
- The durable "why" behind the 3 biggest decisions is recorded in ADRs, not lost in chat history.
- `progress.md` and `CLAUDE-HANDOFF.md` no longer live at the root; they're either renamed or archived.
- `README.md` gives a non-technical visitor a clear picture of what the project is and a working link to the live app.
- No new dependencies, no new build step.

## Trade-offs acknowledged

- **Duplication risk** — ARCHITECTURE.md and module-map.md both describe the module structure. Split: ARCHITECTURE.md is narrative ("here's how data flows"); module-map.md is tabular ("file → one-liner → deps"). If they drift, module-map is source of truth.
- **Per-folder AGENTS.md bloat** — two files now, possibly more later. If the repo grows a third top-level code folder, it gets its own; the root `AGENTS.md` stays small by not duplicating them.
- **ADR discipline** — the format only helps if new decisions actually get ADRs. `AGENTS.md` change-protocol reinforces this. Ultimate enforcement is reviewer (human or agent) discipline.
