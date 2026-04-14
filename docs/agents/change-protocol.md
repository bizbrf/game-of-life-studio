# Change protocol

When a change touches more than one module, these rules keep the split honest.

## Before you edit

1. Identify the **smallest set** of modules needed. If the change seems to touch 3+, pause and reconsider the boundary.
2. Read each affected folder's `AGENTS.md`.
3. Check [module-map.md](module-map.md) for reverse dependencies — who imports the module you're editing?
4. If you're touching `state.js`, you're changing the contract for every module. Be extra careful.

## During the edit

### Adding a new export

- Add it to the module.
- Add it to [module-map.md](module-map.md)'s "Public surface per module" section for that file.
- If the export changes how the module is typically used, update [ARCHITECTURE.md](../../ARCHITECTURE.md).

### Removing or renaming an export

- Find every importer via grep: `grep -rn "fromModule" game-of-life-v2/scripts/`.
- Update all importers in the same commit. No half-renames.
- Update [module-map.md](module-map.md).

### Changing a function signature

- Update all call sites in the same commit.
- If the signature change alters behaviour meaningfully (not just parameter order), mention it in the journal.

### Adding a new module

- Place it in `game-of-life-v2/scripts/`.
- Top comment: one line describing the module's single responsibility.
- Add a row to [module-map.md](module-map.md) and to the module list in [scripts/AGENTS.md](../../game-of-life-v2/scripts/AGENTS.md).
- If the module represents a new architectural concern, open an ADR.

### Changing shared state shape

- Update `state.js`.
- Search for every reader of the changed field — `grep -rn "state\.fieldName" game-of-life-v2/scripts/`.
- Update them in the same commit. Don't leave latent readers holding the old shape.
- If the shape change is large, mention it in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Prohibited patterns

- **Two modules writing to the same `state` field from unrelated code paths.** If you find this, refactor so one module owns the field.
- **DOM access outside `app.js` / `ui.js`.** Sim, render, history, io, and rules modules must not reach for `document` or `window`.
- **New globals on `window`.** The existing three (`render_game_to_text`, `advanceTime`, `__gameOfLifeV2`) exist as test hooks. Do not add more without a clear test rationale.
- **`console.log` left in shipped code.** Remove debug logs before committing.
- **Catching errors to hide them.** `try/catch` without rethrow or a user-visible toast is a silent failure.

## After the edit

1. Run the verification protocol: [verification.md](verification.md).
2. Append a journal entry to [../journal.md](../journal.md).
3. If the change was architectural, update [ARCHITECTURE.md](../../ARCHITECTURE.md) and open/update an ADR.
