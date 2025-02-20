#!/usr/bin/env bash
set -eu
set -o pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dry=
usage="
release.bash [-h][-n]
-h help
-n dry run
Release based on changes since last tag
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

# NOTE: semver converts the tags to an actual version, so this outputs the version number
latest_version="$(git tag --list "v*" | xargs npx semver | tail -n1)"
if [[ -z "$latest_version" ]]; then
  echo "No tags found" >&2
  exit 1
fi

changelog="$(cat "$root_dir/CHANGELOG.md")"

is_breaking=
feats=()
fixes=()

while read commit_subject; do
  if [[ "$commit_subject" =~ ^([a-z]+?)(\(.+?\))?(!)?:\s*(.+) ]]; then
    level="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[2]}"
    excl="${BASH_REMATCH[3]}"
    message="${BASH_REMATCH[4]}"
    if [[ $excl ]]; then
      is_breaking=true
    fi
    echo "-- detected level: $level, scope: $scope, breaking: $excl, message: $message"
    if [[ "$level" == "feat" ]]; then
      feats+=("$message")
    elif [[ "$level" == "fix" ]]; then
      fixes+=("$message")
    fi
  fi
done <<<"$(git log --pretty=format:"%s" HEAD ^"v$latest_version")"

bump=
if [[ "$is_breaking" ]]; then
  bump="major"
elif [[ "${#feats[@]}" -gt 0 ]]; then
  bump="minor"
elif [[ "${#fixes[@]}" -gt 0 ]]; then
  bump="patch"
fi
if ! [[ $bump ]]; then
  echo "No changes detected since last tag"
  exit 0
fi

next="$(npx semver "$latest_version" -i $bump)"


newline="
"
changelog_patch="## $next ($(date +%Y-%m-%d))$newline$newline"
if [[ ${#feats[@]} -gt 0 ]]; then
  changelog_patch+="### Features$newline$newline"
  for msg in "${feats[@]}"; do
    changelog_patch+="* $msg$newline"
  done
  changelog_patch+="$newline"
fi
if [[ ${#fixes[@]} -gt 0 ]]; then
  changelog_patch+="### Fixes$newline$newline"
  for msg in "${fixes[@]}"; do
    changelog_patch+="* $msg$newline"
  done
  changelog_patch+="$newline"
fi

if [[ -n "$dry" ]]; then
  echo "New Changelog: $newline===$newline$changelog_patch==="
  echo "Bump level: $bump"
  echo "Next version: $next"
else
  echo "$changelog_patch$newline$newline$changelog" > "$root_dir/CHANGELOG.md"
  # npm version command makes git tag and commit
  npm version --no--git-tag-version "$next" 
  git add "$root_dir"
  git commit -m "chore(release): $next"
fi