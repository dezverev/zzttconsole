# Save Folder Policy

The `save/` directory contains completed projects and experiments that are meant to be **read-only**. Do not modify files in this directory unless explicitly asked by the user.

- `save/matrix-rain.html` - Standalone Matrix rain effect
- `save/tetris.html` - Matrix-themed Tetris game
- `save/workingrain.html` - Working rain effect (backup/reference)

When working on new features or fixes, create files in the project root or appropriate directories, not in `save/`.

# Git Branch Policy

Always create a new branch before making changes. Never work directly on `main`:

```bash
git checkout -b feature/your-feature-name
```

Or for bug fixes:

```bash
git checkout -b fix/issue-description
```

The `ship` skill automates this workflow: it creates the branch, commits changes, opens a PR, and merges upon approval.

# Branch Strategy

- **`main`** - Production-ready code. Never push directly to main.
- **`dev`** - Integration branch for merged features. Created after each merge to main.
- **`feature/*`** - Feature development branches. Merged via PR to main, then `dev` is created.
- **`fix/*`** - Bug fix branches. Merged via PR to main, then `dev` is created.

# Merge Policy

The ship skill automatically merges pull requests after creating them. Users should NOT merge PRs manually through GitHub's web UI. Always use the `ship` skill for merging changes.
