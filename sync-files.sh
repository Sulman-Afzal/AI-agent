#!/bin/bash
# sync-files.sh - Sync shared files to all branches and push

FILES=("prompts.js" "data/about_me.txt" "sync-files.sh")
BRANCHES=("main" "development" "claude" "node-bot" "voice-msg")
CURRENT=$(git branch --show-current)

echo "Syncing files from '$CURRENT' to all branches..."

# Ensure changes are committed first
git add ${FILES[@]}
git commit -m "Update shared files" 2>/dev/null || echo "No new changes to commit"

# Copy to each branch
for branch in "${BRANCHES[@]}"; do
    if [ "$branch" != "$CURRENT" ]; then
        echo "→ Syncing to $branch..."
        git checkout $branch
        git checkout $CURRENT -- ${FILES[@]}
        git add ${FILES[@]}
        git commit -m "Sync shared files from $CURRENT" 2>/dev/null || echo "  (no changes)"
    fi
done

# Return to original branch
git checkout $CURRENT

# Push all branches
echo "→ Pushing all branches to remote..."
git push origin --all

echo "✓ Done! Files synced and pushed to all branches."
