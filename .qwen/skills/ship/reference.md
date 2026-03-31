# Reference: Ship Skill

## Commands Used

| Command | Purpose |
|---------|---------|
| `git branch --show-current` | Check current branch |
| `git checkout -b <name>` | Create and switch to new branch |
| `git status` | Show changed files |
| `git diff HEAD` | Review all changes |
| `git add .` | Stage all changes |
| `git commit -m "<msg>"` | Commit staged changes |
| `git push origin <branch>` | Push branch to remote |
| `gh pr create` | Create pull request |
| `gh pr merge <pr>` | Merge pull request |

## Branch Naming Convention

- Features: `feature/<description>`
- Fixes: `fix/<description>`
- Hotfixes: `hotfix/<description>`

## Requirements

- Git CLI
- GitHub CLI (`gh`) for automated PR creation
- Authenticated with your remote repository
