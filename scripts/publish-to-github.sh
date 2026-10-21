#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="https://github.com/dev-vbs/vbios-client.git"
BRANCH="main"

# Запускайте из корня распакованного проекта в Git Bash.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
  git branch -M "$BRANCH"
  git remote add origin "$REPOSITORY"
elif ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPOSITORY"
fi

git add .
git commit -m "feat: redesign account dashboard and add Docker CI" || true
git push -u origin "$BRANCH"

echo "Published. Image will be available at ghcr.io/dev-vbs/vbios-client after the GitHub Actions workflow succeeds."
