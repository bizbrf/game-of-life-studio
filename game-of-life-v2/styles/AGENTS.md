# styles/ — stylesheet and design tokens

Single file: `main.css`. Loaded by `index.html` via `<link rel="stylesheet">`. No CSS-in-JS, no preprocessor.

## Token system

All colours, spacing, blurs, and radii are CSS custom properties declared in `:root` at the top of `main.css`. Themes override the tokens — they do not override individual rules.

| Token family | Purpose |
|---|---|
| `--bg`, `--bg-2` | Base canvas backgrounds (radial + linear gradients) |
| `--surface`, `--surface-strong`, `--surface-soft` | Panel glass layers |
| `--border`, `--border-strong` | Panel + control borders |
| `--text`, `--text-dim` | Foreground text at two emphasis levels |
| `--accent`, `--accent-rgb` | Brand accent (user-configurable) |
| `--success`, `--danger` | Semantic feedback colours |
| `--panel-blur`, `--panel-radius`, `--shadow` | Glass treatment |
| `--font-sans`, `--font-mono` | Typography stacks |

## Rules

- **Do not introduce new hard-coded colours.** Reach for a token. If none fits, add a token.
- **Do not introduce new breakpoints without a comment.** The app is responsive by composition, not by breakpoint proliferation.
- **Do not introduce `!important`.** If you need it, the rule is too specific. Flatten first.
- **Match existing design restraint.** The target is Apple HIG / Linear / Arc — calm, intentional, not flashy. If a change adds noise (new gradients, shadows, glow effects), justify it in the journal.
- **Custom select and popover classes are wired in `ui.js`.** Keep visible proxy controls and hidden native selects in sync; native selects remain app-state controls for import/export and tests.

## Change protocol

- Visual changes require a before/after screenshot in the PR or journal entry.
- New tokens go in `:root`. Document what they're for if the name isn't obvious.
- Theme-specific overrides belong in the themed blocks, not scattered through the file.
