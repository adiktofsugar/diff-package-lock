#!/usr/bin/env bash
set -eu
set -o pipefail

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

bump_level=0
while read commit_subject; do
  if [[ "$commit_subject" =~ ^feat ]]; then
    echo "-- feat version detected: $commit_subject"
    bump_level=$(( 2 > $bump_level ? 2 : $bump_level ))
    break
  elif [[ "$commit_subject" =~ ^fix ]]; then
    echo "-- fix version detected: $commit_subject"
    bump_level=$(( 1 > $bump_level ? 1 : $bump_level ))
  fi
done <<<"$(git log --pretty=format:"%s" HEAD ^"v$latest_version")"

bumps=(none patch minor major)
bump="${bumps[$bump_level]}"
if [[ $bump = none ]]; then
  echo "No changes detected since last tag"
  exit 0
fi

next="$(npx semver "$latest_version" -i $bump)"
if [[ -n "$dry" ]]; then
  echo "Bump level: $bump"
  echo "Next version: $next"
else
  echo "Implementation not complete">&2
  exit 1
  # git tag "v$next"
  # git push origin "v$next"
fi