# Changelog

All notable changes to this project will be documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The narrative dev log lives in [docs/journal.md](docs/journal.md). This file records release-shaped changes only — one entry per tag.

## [Unreleased]

### Added
- Initial repository setup with LICENSE (MIT), README, CONTRIBUTING, and GitHub issue/PR templates.
- `AGENTS.md` framework: root contract plus per-folder rules for `scripts/` and `styles/`.
- `ARCHITECTURE.md` and `docs/agents/` (module map, change protocol, verification playbook).
- First three ADRs: sparse grid representation, no-build/no-framework stance, module split boundaries.
- Canonical screenshots in `docs/screenshots/`.
- Live demo via GitHub Pages.

### Changed
- `CLAUDE-HANDOFF.md` archived as `docs/handoffs/2026-04-14-initial-handoff.md`; durable rules folded into `AGENTS.md`.
- `progress.md` renamed to `docs/journal.md`.
- `IMPLEMENTATION-SPEC.md` moved to `docs/specs/2026-04-14-v2-implementation-spec.md`.

### Removed
- Ad-hoc iteration screenshots from `output/`; three canonical ones promoted to `docs/screenshots/`.

<!--
Release entries go above this line. Template:

## [X.Y.Z] - YYYY-MM-DD

### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
-->
