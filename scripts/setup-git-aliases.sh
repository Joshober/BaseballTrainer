#!/bin/bash
# Script to set up git aliases for push-and-pr functionality

echo "Setting up git aliases..."

# Add alias for push-and-pr
git config --global alias.pushpr '!bash -c "cd \"$(git rev-parse --show-toplevel)\" && bash scripts/push-and-pr.sh \"$@\"" --'

# Add alias for push with PR creation
git config --global alias.pushpr-simple '!bash -c "cd \"$(git rev-parse --show-toplevel)\" && bash scripts/push-and-pr.sh"'

echo "✅ Git aliases configured!"
echo ""
echo "Usage:"
echo "  git pushpr                    # Push and create PR interactively"
echo "  git pushpr \"commit msg\"      # Commit, push, and create PR"
echo "  git pushpr-simple             # Quick push and PR"
echo ""
echo "Or use npm:"
echo "  npm run push-pr"
echo "  npm run push:pr"

