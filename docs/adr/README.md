# Architecture Decision Records

Short, numbered records of architectural decisions. Each ADR captures **why** a choice was made, so agents and future contributors don't have to reverse-engineer intent from code.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-sparse-grid-map.md) | Sparse grid as `Map<string, number>` | Accepted |
| [0002](0002-no-build-no-framework.md) | No build tooling, no framework | Accepted |
| [0003](0003-module-split-boundaries.md) | Module split boundaries for v2 refactor | Accepted |

## Format

One page max. Four sections:

```markdown
# ADR-NNNN: <Title>

**Status:** Proposed | Accepted | Superseded by [ADR-NNNN](...) | Deprecated
**Date:** YYYY-MM-DD

## Context
What problem, what constraints, what was tried.

## Decision
What was chosen, in one or two sentences.

## Consequences
Upsides, downsides, what this closes off.
```

## Rules

- **Append-only.** Accepted ADRs are not edited (except for the Status line when superseded). Write a new ADR that references the old one instead.
- **Narrow scope.** One decision per ADR. If two decisions are coupled, two ADRs that reference each other.
- **One page max.** If it needs more than a page, the decision has too many sub-decisions hidden inside it.
- **Numbered sequentially.** Zero-padded to four digits.

## When to write one

- A new dependency or framework is being considered.
- A module boundary is being drawn or moved.
- An invariant is being introduced or relaxed.
- A non-obvious tradeoff is being made (performance vs simplicity, compatibility vs cleanliness).
- Anything you'll regret not documenting when you come back in six months.
