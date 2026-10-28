#!/usr/bin/env bash
# Mirror the wiki/ folder into the GitHub wiki repository.
#
# The wiki is edited in wiki/ and reviewed with the code. This script copies
# the committed pages to https://github.com/VectoDE/HTML-Template.wiki.git,
# removes pages that no longer exist here, and pushes the result.
set -euo pipefail

WIKI_URL="https://github.com/VectoDE/HTML-Template.wiki.git"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ ! -d wiki ]]; then
  echo "wiki/ does not exist in $repo_root" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain -- wiki)" ]]; then
  echo "wiki/ has uncommitted changes. Commit or discard them first." >&2
  exit 1
fi

source_commit="$(git rev-parse --short HEAD)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

git clone --quiet "$WIKI_URL" "$workdir/wiki"

# Remove pages that were deleted from wiki/.
for existing in "$workdir"/wiki/*.md; do
  [[ -e "$existing" ]] || continue
  if [[ ! -e "wiki/$(basename "$existing")" ]]; then
    rm -- "$existing"
  fi
done

cp -- wiki/*.md "$workdir/wiki/"

cd "$workdir/wiki"
git add --all
if git diff --cached --quiet; then
  echo "The wiki is already up to date."
  exit 0
fi

git commit --quiet -s -m "docs(wiki): sync from ${source_commit}" \
  -m "Source: VectoDE/HTML-Template@${source_commit}"
git push --quiet origin HEAD
echo "Wiki updated from ${source_commit}."
