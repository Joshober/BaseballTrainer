#!/bin/bash
# Script to push current branch and create a pull request
# Usage: bash scripts/push-and-pr.sh [commit message] [pr title] [pr description]

set -e

echo "============================================================"
echo "Push and Create Pull Request"
echo "============================================================"
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH="main"

if [ -z "$CURRENT_BRANCH" ]; then
    echo "❌ Could not determine current branch"
    exit 1
fi

if [ "$CURRENT_BRANCH" = "$TARGET_BRANCH" ]; then
    echo "❌ Cannot create PR from $TARGET_BRANCH to itself"
    echo "   Please switch to a feature branch first"
    exit 1
fi

echo "📋 Current branch: $CURRENT_BRANCH"
echo "🎯 Target branch: $TARGET_BRANCH"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes"
    echo ""
    
    # Show status
    git status --short
    
    echo ""
    read -p "   Do you want to commit these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Get commit message
        if [ -n "$1" ]; then
            COMMIT_MSG="$1"
        else
            read -p "   Commit message: " COMMIT_MSG
            if [ -z "$COMMIT_MSG" ]; then
                COMMIT_MSG="feat: Update from $CURRENT_BRANCH"
            fi
        fi
        
        # Stage all changes
        git add -A
        
        # Commit
        git commit -m "$COMMIT_MSG"
        echo "✅ Changes committed"
    else
        echo "⚠️  Skipping commit. Pushing existing commits..."
    fi
fi

# Check if branch exists on remote
if git ls-remote --heads origin "$CURRENT_BRANCH" | grep -q "$CURRENT_BRANCH"; then
    echo ""
    echo "📤 Pushing to existing remote branch..."
    git push origin "$CURRENT_BRANCH"
else
    echo ""
    echo "📤 Pushing new branch to origin..."
    git push -u origin "$CURRENT_BRANCH"
fi

echo "✅ Branch pushed successfully"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI (gh) is not installed"
    echo ""
    echo "💡 To install GitHub CLI:"
    echo "   macOS: brew install gh"
    echo "   Linux: See https://cli.github.com/"
    echo ""
    echo "📝 Create PR manually:"
    echo "   https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    echo ""
    exit 0
fi

# Check if user is authenticated with GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "⚠️  Not authenticated with GitHub CLI"
    echo "   Run: gh auth login"
    echo ""
    echo "📝 Create PR manually:"
    echo "   https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    echo ""
    exit 0
fi

# Check if PR already exists
EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH" --base "$TARGET_BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")
if [ -n "$EXISTING_PR" ]; then
    echo "ℹ️  Pull request already exists: #$EXISTING_PR"
    echo ""
    read -p "   Open existing PR? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh pr view "$EXISTING_PR" --web
    fi
    exit 0
fi

# Get PR details
echo "📝 Pull Request Details"
echo ""

# Get last commit message as default title
LAST_COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)
DEFAULT_TITLE="${LAST_COMMIT_MSG:-feat: Update from $CURRENT_BRANCH}"

# Use provided title or ask for it
if [ -n "$2" ]; then
    PR_TITLE="$2"
else
    read -p "PR Title [$DEFAULT_TITLE]: " PR_TITLE
    PR_TITLE=${PR_TITLE:-$DEFAULT_TITLE}
fi

# Get PR description
if [ -n "$3" ]; then
    PR_DESCRIPTION="$3"
else
    echo ""
    echo "PR Description (optional, press Enter to skip):"
    read -p "> " PR_DESCRIPTION
    
    # If empty, generate from commits
    if [ -z "$PR_DESCRIPTION" ]; then
        COMMITS=$(git log origin/$TARGET_BRANCH..HEAD --oneline 2>/dev/null | head -10 || echo "No commits to show")
        PR_DESCRIPTION="## Changes

This PR includes the following changes:

\`\`\`
$COMMITS
\`\`\`
"
    fi
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
    
    # Get PR number and URL
    PR_NUMBER=$(gh pr list --head "$CURRENT_BRANCH" --base "$TARGET_BRANCH" --json number --jq '.[0].number')
    PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url')
    
    echo "📋 PR #$PR_NUMBER: $PR_URL"
    echo ""
    
    # Ask if user wants to open in browser
    read -p "   Open PR in browser? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh pr view "$PR_NUMBER" --web
    fi
else
    echo "❌ Failed to create pull request"
    echo ""
    echo "📝 Create PR manually:"
    echo "   https://github.com/Joshober/BaseballTrainer/compare/$TARGET_BRANCH...$CURRENT_BRANCH"
    exit 1
fi

