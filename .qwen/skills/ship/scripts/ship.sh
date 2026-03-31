#!/bin/bash
# Ship: Automated Git workflow for features and fixes

set -e

echo "🚀 Starting ship workflow..."

# Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "❌ Not on main or master branch. Current branch: $CURRENT_BRANCH"
    exit 1
fi

echo "✅ On main branch"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Uncommitted changes detected"
    
    # Stage all changes
    git add .
    echo "✅ Changes staged"
    
    # Get diff for commit message
    DIFF=$(git diff --cached --stat)
    echo "Changes to commit:"
    echo "$DIFF"
    
    # Prompt for commit message
    read -p "Enter commit message (or press Enter for auto): " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="chore: automated commit via ship"
    fi
    
    git commit -m "$COMMIT_MSG"
    echo "✅ Changes committed"
fi

# Prompt for branch name
read -p "Enter feature/fix branch name: " BRANCH_NAME

if [ -z "$BRANCH_NAME" ]; then
    echo "❌ Branch name required"
    exit 1
fi

# Create and push branch
git checkout -b "$BRANCH_NAME"
git push origin "$BRANCH_NAME"
echo "✅ Branch created and pushed: $BRANCH_NAME"

# Create PR using GitHub CLI
if command -v gh &> /dev/null; then
    echo "Creating PR with GitHub CLI..."
    PR_URL=$(gh pr create --title "$BRANCH_NAME" --body "Automated PR from ship workflow")
    echo "✅ PR created: $PR_URL"

    # Extract PR number and merge
    PR_NUMBER=$(echo "$PR_URL" | grep -oP '\d+$')
    echo "Merging PR #$PR_NUMBER..."
    gh pr merge "$PR_NUMBER" --merge
    echo "✅ PR merged"

    # Create dev branch from main
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
        echo "Creating dev branch..."
        git checkout -b dev
        git push origin dev
        echo "✅ Dev branch created and pushed"
    else
        echo "ℹ️  Not on main/master, skipping dev branch creation"
    fi
else
    echo "ℹ️  GitHub CLI not installed. Create PR manually at: https://github.com"
fi

echo "🚀 Ship workflow complete!"
