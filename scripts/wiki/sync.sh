#!/usr/bin/env bash
# Mirror the wiki/ folder into the GitHub wiki repository.
#
# The wiki is edited in wiki/ and reviewed with the code. This script copies
# the committed pages to https://github.com/VectoDE/HTML-Template.wiki.git,
# removes pages that no longer exist here, and pushes the result.
# Edits made directly in the GitHub wiki are overwritten.
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

if [[ -z "$(git config user.name)" || -z "$(git config user.email)" ]]; then
  echo "Set git user.name and user.email before syncing." >&2
  exit 1
fi

shopt -s nullglob
pages=(wiki/*.md)
if [[ ${#pages[@]} -eq 0 ]]; then
  echo "wiki/ contains no .md pages." >&2
  exit 1
fi

source_commit="$(git rev-parse --short HEAD)"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

if ! git clone --quiet "$WIKI_URL" "$workdir/wiki"; then
  echo "Cannot clone the wiki. Create the first page once in the GitHub UI, and make sure the wiki is enabled." >&2
  exit 1
fi

# Remove pages that were deleted from wiki/.
for existing in "$workdir"/wiki/*.md; do
  [[ -e "$existing" ]] || continue
  if [[ ! -e "wiki/$(basename "$existing")" ]]; then
    rm -- "$existing"
  fi
done

cp -- "${pages[@]}" "$workdir/wiki/"

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
