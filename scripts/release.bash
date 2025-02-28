#!/usr/bin/env bash
set -eu
set -o pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dry=
usage="
release.bash [-h][-n] [<ref>]
-h help
-n dry run
<ref> a git identifier, defaults to last (semver) tag

Release a new version based on changes since <ref>
Exits with 2 if no changes detected
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


shift $((OPTIND - 1))
ref="${1:-}"
if [[ -z "$ref" ]]; then
  last_semver_version="$(git tag --list "v*" | xargs npx semver | tail -n1)"
  if [[ -z "$last_semver_version" ]]; then
    echo "Could not determine last semver version" >&2
    exit 1
  fi
  # NOTE: semver converts the tags to an actual version, so this outputs the version number
  ref="v$last_semver_version"
fi


major_changes=()
minor_changes=()
patch_changes=()

max_bump=0

while read line; do
  commit_hash="${line%% *}"
  line="${line#* }"
  commit_subject="${line}"
  if [[ "$commit_subject" =~ ^([a-z]+?)(\(.+?\))?(!)?:\s*(.+) ]]; then
    level="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[2]}" # note: still has parentheses
    excl="${BASH_REMATCH[3]}"
    message="${BASH_REMATCH[4]}"
    message="${message# *}" # remove leading space

    entry="${message} ($commit_hash)"
    if [[ $excl ]]; then
      max_bump=3
      major_changes+=("$entry")
    elif [[ "$level" == "feat" ]]; then
      max_bump=$(( max_bump > 2 ? max_bump : 2 ))
      minor_changes+=("$entry")
    elif [[ "$level" == "fix" ]]; then
      max_bump=$(( max_bump > 1 ? max_bump : 1 ))
      patch_changes+=("$entry")
    fi
  fi
done <<<"$(git log --pretty=format:"%h %s" HEAD ^"$ref")"

if [[ $max_bump = 0 ]]; then
  echo "No changes detected" >&2
  exit 2
fi

bumps=(patch minor major)
bump=${bumps[$max_bump - 1]}
changelog="$(cat "$root_dir/CHANGELOG.md")"
current_version="$(npm view . version)"
next_version="$(npx semver "$current_version" -i $bump)"
newline="
"
changelog_patch="## [$next_version](https://github.com/adiktofsugar/diff-package-lock/compare/v$current_version...v$next_version) ($(date +%Y-%m-%d))$newline$newline$newline"
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
  add_changes "⚠ BREAKING CHANGES" "${major_changes[@]}"
fi
if [[ ${#minor_changes[@]} -gt 0 ]]; then
  add_changes "Features" "${minor_changes[@]}"
fi
if [[ ${#patch_changes[@]} -gt 0 ]]; then
  add_changes "Bug Fixes" "${patch_changes[@]}"
fi

if [[ -n "$dry" ]]; then
  echo "New Changelog: $newline===$newline$changelog_patch==="
  echo "Bump level: $bump"
  echo "Next version: $next_version"
else
  echo "$changelog_patch$changelog" > "$root_dir/CHANGELOG.md"
  # we need to prevent npm from making the tag / commit because it requires the workspace to be clean
  npm version --no-git-tag-version "$next_version"
  git add "$root_dir"
  git commit -m "chore(release): $next_version"
  git tag "v$next_version"
fi