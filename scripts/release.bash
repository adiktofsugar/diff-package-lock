#!/usr/bin/env bash
set -eu
set -o pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dry=
usage="
release.bash [-h][-n]
-h help
-n dry run

Reads changes from stdin and creates release based on max bump
Input lines should be in this format:
  <commit> <bump> <message>
Example:
  d78883d minor remove the dependency graph (#44)
"

while getopts "hn" opt; do
  case $opt in
    h)
      echo "$usage"
      exit 0
      ;;
    n)
      dry=true
      ;;
    \?)
      echo "$usage"
      exit 1
      ;;
  esac
done

major_changes=()
minor_changes=()
patch_changes=()

max_bump=0
while read line; do
  commit_hash="${line%% *}"
  line="${line#* }"
  bump="${line%% *}"
  line="${line#* }"
  message="${line}"
  entry="${message} ($commit_hash)"
  if [[ "$bump" == "major" ]]; then
    max_bump=3
    major_changes+=("$entry")
  elif [[ "$bump" == "minor" && "$max_bump" != "major" ]]; then
    max_bump=$(( max_bump > 2 ? max_bump : 2 ))
    minor_changes+=("$entry")
  elif [[ "$bump" == "patch" && "$max_bump" != "major" && "$max_bump" != "minor" ]]; then
    max_bump=$(( max_bump > 1 ? max_bump : 1 ))
    patch_changes+=("$entry")
  fi
done

if [[ $max_bump = 0 ]]; then
  echo "No changes detected" >&2
  exit 1
fi

changelog="$(cat "$root_dir/CHANGELOG.md")"
current_version="$(npm view . version)"
next_version="$(npx semver "$current_version" -i $bump)"
newline="
"
changelog_patch="## $next_version ($(date +%Y-%m-%d))$newline$newline"
function add_changes() {
  local level="$1"
  local messages=("${@:2}")
  if [[ ${#messages[@]} -gt 0 ]]; then
    changelog_patch+="### $level$newline$newline"
    for msg in "${messages[@]}"; do
      changelog_patch+="* $msg$newline"
    done
    changelog_patch+="$newline"
  fi
}
if [[ ${#major_changes[@]} -gt 0 ]]; then
  add_changes "Breaking" "${major_changes[@]}"
fi
if [[ ${#minor_changes[@]} -gt 0 ]]; then
  add_changes "Features" "${minor_changes[@]}"
fi
if [[ ${#patch_changes[@]} -gt 0 ]]; then
  add_changes "Fixes" "${patch_changes[@]}"
fi

if [[ -n "$dry" ]]; then
  echo "New Changelog: $newline===$newline$changelog_patch==="
  echo "Bump level: $bump"
  echo "Next version: $next_version"
else
  echo "$changelog_patch$newline$newline$changelog" > "$root_dir/CHANGELOG.md"
  # npm version command makes git tag and commit
  npm version --no-git-tag-version "$next_version" 
  git add "$root_dir"
  git commit -m "chore(release): $next_version"
fi