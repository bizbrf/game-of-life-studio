# Release checklist

Use this for tagged releases after the feature branch is ready.

## Before merge

- [ ] `CHANGELOG.md` has a dated release entry and no stale claims.
- [ ] `README.md` screenshots and live-demo links match the app.
- [ ] `node --check` passes for every `game-of-life-v2/scripts/*.js` file.
- [ ] `git diff --check` passes.
- [ ] Browser smoke passes against `python -m http.server 8765 --bind 127.0.0.1`.
- [ ] UI changes have current screenshots in `docs/screenshots/` or `output/`.
- [ ] `docs/journal.md` has the verification entry.

## GitHub

- [ ] Pull request is reviewed and CI is green.
- [ ] GitHub Pages deployment completes for the merge commit.
- [ ] Release tag is annotated: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
- [ ] GitHub release points at the release tag and includes verification notes.
- [ ] Live URL returns 200 and loads `game-of-life-v2/index.html`.
- [ ] Merged release branch is deleted or explicitly kept.
- [ ] Open issues are closed, moved, or assigned to the next milestone.
