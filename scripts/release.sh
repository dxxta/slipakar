#!/usr/bin/env bash
# Usage: scripts/release.sh <patch|minor|major>
# Bumps the version, tags it, then pushes HEAD and the tag to the branch you type.
set -euo pipefail

level="${1:-}"
case "$level" in
  patch|minor|major) ;;
  *) echo "Usage: $0 <patch|minor|major>" >&2; exit 1 ;;
esac

remote="${RELEASE_REMOTE:-origin}"
current="$(git branch --show-current)"
read -r -p "Branch to push to on ${remote} [${current:-HEAD}]: " branch
branch="${branch:-$current}"

npx commit-and-tag-version --release-as "$level"

if [ -n "$branch" ]; then
  git push --follow-tags "$remote" "HEAD:${branch}"
else
  git push --follow-tags "$remote" HEAD
fi
