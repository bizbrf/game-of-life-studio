# Contributing

Thanks for your interest. This is a personal project but external contributions are welcome.

## For humans

1. Fork the repo.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Make your change and test it locally (see [README.md](README.md) for running locally).
4. Commit with a clear message describing **why**, not just **what**.
5. Open a PR against `main` using the template.

### Checklist before opening a PR

- App still runs — open `game-of-life-v2/index.html` and exercise the feature.
- No new console errors.
- Touch/keyboard interactions you changed were tested.
- If you changed the UI, include a before/after screenshot.

## For AI agents

See [AGENTS.md](AGENTS.md) (added in the documentation cycle) for the project's AI-agent navigation framework — the module map, change-protocol, and verification requirements live there.

## Code style

- Plain JavaScript, ES modules, no build step.
- One responsibility per file (sim, render, input, ui, ...). Keep it that way.
- Avoid adding dependencies.
- Comments explain **why**, not **what**. Well-named identifiers carry the rest.

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).

## Requesting features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md).
