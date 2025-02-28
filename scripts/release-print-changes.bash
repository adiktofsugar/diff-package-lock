#!/usr/bin/env bash
set -eu
set -o pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

dry=
usage="
release-print-changes.bash [-h] [<ref>]
-h help
<ref> a git identifier. defaults to last (semver) tag
Print changes since <ref>
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
    bump=
    if [[ $excl ]]; then
      bump="major"
    elif [[ "$level" == "feat" ]]; then
      bump="minor"
    elif [[ "$level" == "fix" ]]; then
      bump="patch"
    fi
    if [[ -n "$bump" ]]; then
      echo "$commit_hash $bump $message"
    fi
  fi
done <<<"$(git log --pretty=format:"%h %s" HEAD ^"$ref")"