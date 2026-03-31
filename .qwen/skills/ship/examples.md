# Examples: Ship Skill

## Example 1: Add New Feature

**User Request:**
> "Ship this"

**Workflow:**
1. Check current branch → `main`
2. Create branch → `feature/add-settings-page`
3. Stage changes → `git add .`
4. Commit → `feat(user): add settings page to dashboard`
5. Push branch → `git push origin feature/add-settings-page`
6. Create PR → GitHub CLI prompts for title/description
7. Merge PR → `gh pr merge <pr-number> --merge`

---

## Example 2: Fix Bug

**User Request:**
> "Fix the authentication token expiration issue"

**Workflow:**
1. Check current branch → `main`
2. Create branch → `fix/auth-token-expiry`
3. Stage changes → `git add .`
4. Commit → `fix(auth): resolve token expiration bug`
5. Push branch → `git push origin fix/auth-token-expiry`
6. Create PR → GitHub CLI prompts for title/description
7. Merge PR → `gh pr merge <pr-number> --merge`

---

## Example 3: Refactor Code

**User Request:**
> "Refactor the API client to use async/await"

**Workflow:**
1. Check current branch → `main`
2. Create branch → `refactor/api-client-async`
3. Stage changes → `git add .`
4. Commit → `refactor(api): convert to async/await`
5. Push branch → `git push origin refactor/api-client-async`
6. Create PR → GitHub CLI prompts for title/description
7. Merge PR → `gh pr merge <pr-number> --merge`
