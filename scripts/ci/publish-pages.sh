#!/usr/bin/env bash
# Write to the `release` branch, which GitHub Pages serves (plan S6).
#
#   publish-pages.sh site <dir>             the live site: everything but previews/
#   publish-pages.sh preview <pr> <dir>     a pull request's build, at previews/<pr>/
#   publish-pages.sh remove-preview <pr>
#
# The deploy and the previews of open pull requests all write here, at any
# time. Each change is a new commit on top of the branch as it is now, pushed
# without force; if someone else pushed meanwhile, it starts again from the
# new tip. A force push here used to be the deploy, and would now delete
# every preview, or a deploy, written in between.
#
# Sets PUBLISHED_SHA (the commit pushed, empty if nothing changed) in
# $GITHUB_ENV when run in Actions.
set -euo pipefail

mode=${1:?mode}
root=$(git rev-parse --show-toplevel)
work=$(mktemp -d)
cleanup() { git -C "$root" worktree remove --force "$work" 2>/dev/null || rm -rf "$work"; }
trap cleanup EXIT

case "$mode" in
  site) src=$(realpath "${2:?dir}"); message="Build: Update release artifacts from main [skip ci]" ;;
  preview) pr=${2:?pr}; src=$(realpath "${3:?dir}"); message="Preview: pull request #$pr [skip ci]" ;;
  remove-preview) pr=${2:?pr}; message="Preview: remove pull request #$pr [skip ci]" ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac
[[ "${pr:-0}" =~ ^[0-9]+$ ]] || { echo "not a pull request number: $pr" >&2; exit 2; }

git config --global user.email "github-actions[bot]@users.noreply.github.com" 2>/dev/null || true
git config --global user.name "github-actions[bot]" 2>/dev/null || true

for attempt in 1 2 3 4 5 6; do
  cleanup; work=$(mktemp -d); rmdir "$work"
  if git -C "$root" fetch --quiet origin release 2>/dev/null; then
    git -C "$root" worktree add --quiet --detach "$work" FETCH_HEAD
  else
    git -C "$root" worktree add --quiet --detach "$work"
    git -C "$work" checkout --quiet --orphan release-new
    git -C "$work" rm -rfq . 2>/dev/null || true
  fi

  case "$mode" in
    site)
      find "$work" -mindepth 1 -maxdepth 1 ! -name .git ! -name previews -exec rm -rf {} +
      cp -r "$src"/. "$work"/
      ;;
    preview)
      rm -rf "$work/previews/$pr"
      mkdir -p "$work/previews/$pr"
      cp -r "$src"/. "$work/previews/$pr"/
      # One domain, one CNAME: the preview's own copy would be ignored anyway.
      rm -f "$work/previews/$pr/CNAME"
      ;;
    remove-preview)
      rm -rf "$work/previews/$pr"
      ;;
  esac

  git -C "$work" add -A
  if git -C "$work" diff --cached --quiet; then
    echo "Nothing changed on the release branch."
    [ -n "${GITHUB_ENV:-}" ] && echo "PUBLISHED_SHA=" >> "$GITHUB_ENV"
    exit 0
  fi
  git -C "$work" commit --quiet -m "$message"
  if git -C "$work" push --quiet origin HEAD:refs/heads/release; then
    sha=$(git -C "$work" rev-parse HEAD)
    echo "Pushed $sha to release."
    [ -n "${GITHUB_ENV:-}" ] && echo "PUBLISHED_SHA=$sha" >> "$GITHUB_ENV"
    exit 0
  fi
  echo "release moved on meanwhile; trying again ($attempt)."
  sleep $(( attempt * 5 ))
done
echo "::error::Could not push to the release branch after 6 attempts."
exit 1
