# ADR-0001: Sparse grid as `Map<string, number>`

**Status:** Accepted
**Date:** 2026-04-14

## Context

The v2 app is designed around an **infinite** grid — users can pan indefinitely in any direction, and patterns like glider guns generate unbounded activity over time. A fixed dense 2D array forces a hard boundary, which broke the original v1 experience once users wanted to explore beyond the visible viewport.

Typical populations in the app are small relative to the reachable grid: a few hundred to a few thousand live cells at any moment, against a theoretically infinite coordinate space. At any point in time the sparse set of live cells is a tiny fraction of the reachable grid.

Options considered:

- **Dense 2D array, fixed bounds.** Fast iteration, trivial neighbour lookup, but imposes a hard wall on the grid — breaks the infinite-pan UX.
- **Tiled dense arrays (chunked).** Preserves the infinite grid. Good cache locality inside a chunk. Adds a meaningful layer of bookkeeping (chunk allocation, chunk lifecycle, cross-chunk neighbour counting).
- **Sparse `Map<string, number>`** keyed by `"x,y"`. Trivial infinite extent. Iteration is proportional to population (the only thing we ever care about). String keys are slower than integers but the overhead is negligible at the population counts this app sees.

## Decision

Use `Map<string, number>` in `state.liveCells`, keyed by `"x,y"` strings, with the value representing the cell's **age in generations**. Encoding is centralised in `utils.keyFromXY` / `utils.xyFromKey`; other modules must not hand-assemble keys.

## Consequences

- Infinite pan and zoom work without any coordinate clamping.
- Step cost scales with population, not grid size — the app stays responsive at billions of theoretical cells as long as the live set is small.
- String-key overhead (allocation, hashing, parsing) is real but invisible at current scale. If profiling ever shows it as a bottleneck, migration to a packed integer key (`x * PRIME + y` or a `Map<number, number>` with bit-packing) is the forward path.
- Cache locality is worse than a dense array; iteration order is insertion-based, not spatial. Neighbour counting iterates live cells and their 8 neighbours, which touches `liveCells.size × 9` keys per step — fine at current scale.
- Wrap mode (`state.wrap === true`) requires canonicalising coordinates before keying — handled in `sim.normalizeWrappedCoord` / `sim.normalizeKeyForState`. Mixing wrapped and un-wrapped keys in the same map would be a bug.

## Rules that follow

- Always go through `keyFromXY` / `xyFromKey`. Never concatenate `"x,y"` manually.
- `state.liveCells` is the canonical population. Do not maintain parallel cell sets in other modules — compute derivatives at use site.
- If performance degrades at very high populations, profile before changing encoding.
