#!/bin/bash
# Script to create a pull request from current branch to main
# This script pushes the current branch and creates a PR using GitHub CLI

set -e

echo "============================================================"
echo "Create Pull Request Script"
echo "============================================================"
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH="main"

if [ -z "$CURRENT_BRANCH" ]; then
    echo "❌ Could not determine current branch"
    exit 1
fi

echo "📋 Current branch: $CURRENT_BRANCH"
echo "🎯 Target branch: $TARGET_BRANCH"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes"
    echo "   Please commit or stash them before creating a PR"
    read -p "   Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if branch is ahead of origin
LOCAL_COMMITS=$(git rev-list --count origin/$CURRENT_BRANCH..HEAD 2>/dev/null || echo "0")
if [ "$LOCAL_COMMITS" -eq 0 ]; then
    echo "⚠️  No local commits to push"
    read -p "   Push anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Push current branch
echo ""
echo "📤 Pushing branch to origin..."
if git push -u origin "$CURRENT_BRANCH"; then
    echo "✅ Branch pushed successfully"
else
    echo "❌ Failed to push branch"
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo ""
    echo "⚠️  GitHub CLI (gh) is not installed"
    echo ""
    echo "💡 To install GitHub CLI:"
    echo "   macOS: brew install gh"
    echo "   Linux: See https://cli.github.com/"
    echo ""
    echo "📝 Or create PR manually:"
    echo "   1. Go to: https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    echo "   2. Click 'Create Pull Request'"
    echo ""
    exit 0
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo ""
    echo "⚠️  Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    echo ""
    echo "📝 Or create PR manually:"
    echo "   https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    echo ""
    exit 0
fi

# Get PR title and description
echo ""
echo "📝 Pull Request Details"
echo ""

# Try to get last commit message as default title
LAST_COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)
DEFAULT_TITLE="${LAST_COMMIT_MSG:-feat: Update from $CURRENT_BRANCH}"

read -p "PR Title [$DEFAULT_TITLE]: " PR_TITLE
PR_TITLE=${PR_TITLE:-$DEFAULT_TITLE}

echo ""
echo "PR Description (press Enter twice to finish):"
PR_DESCRIPTION=""
while IFS= read -r line; do
    if [ -z "$line" ] && [ -z "$PR_DESCRIPTION" ]; then
        break
    fi
    PR_DESCRIPTION="${PR_DESCRIPTION}${line}\n"
done

# Get list of commits for description if empty
if [ -z "$PR_DESCRIPTION" ]; then
    COMMITS=$(git log origin/$TARGET_BRANCH..HEAD --oneline | head -10)
    PR_DESCRIPTION="## Changes\n\n"
    PR_DESCRIPTION="${PR_DESCRIPTION}This PR includes the following changes:\n\n"
    PR_DESCRIPTION="${PR_DESCRIPTION}\`\`\`\n$COMMITS\n\`\`\`\n"
fi

# Create pull request
echo ""
echo "🚀 Creating pull request..."
if gh pr create \
    --base "$TARGET_BRANCH" \
    --head "$CURRENT_BRANCH" \
    --title "$PR_TITLE" \
    --body "$PR_DESCRIPTION"; then
    echo ""
    echo "✅ Pull request created successfully!"
    echo ""
    echo "📋 View PR:"
    gh pr view --web
else
    echo "❌ Failed to create pull request"
    echo ""
    echo "📝 Create PR manually:"
    echo "   https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    exit 1
fi

