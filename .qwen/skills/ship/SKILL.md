---
name: ship
description: Automate the complete Git workflow: check main branch, create feature branch, stage/commit changes, open pull request, merge the PR, and create a new dev branch. Use when you want to automate your Git workflow for a new feature or fix.
---

# Ship

## Instructions
This skill automates the complete Git workflow for new features or fixes:

1. **Check current branch** - Verify you're on `main` (or `master`)
2. **Create feature branch** - Generate a new branch with a descriptive name
3. **Stage and commit changes** - Review changes and create a commit
4. **Open pull request** - Create a PR with appropriate title/description
5. **Merge the PR** - Automatically merge the feature branch to main
6. **Create dev branch** - Create a new `dev` branch from the updated main

## Important: Use Feature Branches

**Never push directly to `main` or `master`.** Always create a feature branch for any changes. This ensures:
- Code review through pull requests
- Protected main branch compliance
- Clean, bisectable history

The ship workflow enforces this by:
1. Starting from main/master (clean baseline)
2. Creating a new feature branch for your work
3. Pushing only the branch, never main directly

## Step-by-Step Process

1. **Branch Check**
   - Run `git branch --show-current` to verify current branch
   - If not on main/master, stop and report the issue

2. **Create Feature Branch**
   - Generate branch name from user's task description
   - Format: `feature/short-description` or `fix/issue-number`
   - Run `git checkout -b <branch-name>`

3. **Stage and Commit**
   - Run `git status` to see changed files
   - Run `git diff HEAD` to review changes
   - Suggest a commit message following conventional commits
   - Run `git add .` and `git commit -m "<message>"`

4. **Push and Create PR**
   - Run `git push origin <branch-name>`
   - Use GitHub CLI (`gh pr create`) or GitLab equivalent
   - Include title and description

## Prerequisites

- Git CLI installed and configured
- GitHub CLI (`gh`) installed for PR creation (recommended)
- Authentication set up for your remote repository

## Examples

**Example 1: Add new feature**
> User: "Add a login page to the auth module"

I will:
1. Check we're on main branch
2. Create branch: `feature/add-login-page`
3. Stage and commit changes with message: `feat(auth): add login page component`
4. Push branch and create PR

**Example 2: Fix a bug**
> User: "Fix the navigation bug on mobile"

I will:
1. Check we're on main branch
2. Create branch: `fix/mobile-nav-bug`
3. Stage and commit changes with message: `fix(nav): resolve mobile navigation issue`
4. Push branch and create PR
5. Merge the PR
6. Create new dev branch

## Summary

- ✅ Create feature branches for all work
- ✅ Push branches and open PRs
- ✅ Merge PRs via the ship skill
- ✅ Create dev branch after each merge
- ❌ Never push directly to main/master
- ❌ Do not merge PRs manually through GitHub web UI
