# ADR-0002: No build tooling, no framework

**Status:** Accepted
**Date:** 2026-04-14

## Context

The v2 app is pure HTML + CSS + JavaScript. It was originally written as a single self-contained `index.html` to meet a strict "no external dependencies, no build tools" deliverable. The recent refactor split that single file into 15 ES modules, but the no-build constraint remained.

At the same time, the app has real product ambitions — polished UI, pattern library, rulesets, RLE import/export, themes, touch support. None of those needed a framework; all of them were achievable with the platform.

Options considered:

- **Add a bundler** (esbuild, Vite, Rollup). Benefits: tree-shaking, minification, source maps, fewer HTTP requests in prod. Costs: a `package.json`, an install step, CI tooling, a separate "built" artifact that can drift from source, a bar to entry for contributors.
- **Add a framework** (React, Svelte, Preact, Lit). Benefits: component model, reactive updates, less manual DOM wiring. Costs: dependency surface, runtime cost, steeper learning curve, and — critically — it changes the character of the codebase. This app is a canvas simulation with a thin DOM UI on top; component frameworks optimise for DOM-heavy apps.
- **Stay with plain HTML + CSS + ES modules.** Browsers load `<script type="module">` natively. No step between "edit file" and "refresh browser." Works unchanged on GitHub Pages, `python -m http.server`, any static host.

## Decision

No build step. No framework. No `package.json` (except optionally for dev tooling like Playwright, kept outside the repo). The app is authored in exactly the shape the browser runs. Deployment is `git push` — GitHub Pages serves the repo directly.

## Consequences

- **Zero friction iteration.** Save a file, refresh the browser. No watch processes, no compile errors that are tooling artefacts.
- **Zero dependency surface.** No supply chain to audit. No lockfile. No "please update the lockfile" comments on PRs.
- **Hostable anywhere.** GitHub Pages, Netlify, a USB stick. The app is static.
- **Manual discipline required for module boundaries.** A bundler would enforce tree-shaking and surface dead code; without one, `AGENTS.md` and code review carry that load. `docs/agents/change-protocol.md` is the written version of this discipline.
- **Slightly more HTTP requests on first load.** 15 JS modules plus 1 CSS file. Small enough to be negligible; HTTP/2 multiplexes them; the payload is under 50KB raw.
- **No TypeScript, no JSX, no CSS-in-JS.** If those are ever wanted, they require superseding this ADR, not working around it.

## Rules that follow

- **No new dependencies.** If a dep looks necessary, write a new ADR explaining why this one is wrong, and only then add it.
- No npm scripts, no build commands in the PR workflow.
- Any contributor — human or agent — can open `index.html` via a local server and be editing live within one minute of cloning the repo.
