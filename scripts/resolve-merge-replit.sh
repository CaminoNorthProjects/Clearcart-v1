#!/bin/bash
# Run this script in Replit to resolve merge conflicts.
# Accepts the origin/main (GitHub) version for all conflicted files.

set -e

echo "Resolving merge conflicts (keeping origin/main version)..."

git checkout --theirs src/lib/supabase.ts
git add src/lib/supabase.ts

git checkout --theirs src/pages/Scan.tsx
git add src/pages/Scan.tsx

git checkout --theirs vite.config.ts
git add vite.config.ts

echo "Committing merge..."
git commit -m "Merge Replit and GitHub histories"

echo "Pushing to GitHub..."
git push origin main

echo "Done. Merge complete."
