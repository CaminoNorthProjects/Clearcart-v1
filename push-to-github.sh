#!/bin/bash
# Complete the Zero-Defect push: add remote and push to GitHub
# Usage: ./push-to-github.sh https://github.com/YOUR_USERNAME/YOUR_REPO.git
#
# Prerequisites:
# 1. Create empty GitHub repo at github.com/new (no README/.gitignore)
# 2. Have credentials ready (PAT for HTTPS, SSH key for git@github.com URLs)

if [ -z "$1" ]; then
  echo "Usage: ./push-to-github.sh <GITHUB_REPO_URL>"
  echo "Example: ./push-to-github.sh https://github.com/username/ClearCart.git"
  exit 1
fi

if git remote get-url origin &>/dev/null; then
  git remote set-url origin "$1"
else
  git remote add origin "$1"
fi
git push -u origin main
