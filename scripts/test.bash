#!/bin/bash

root="$(cd `dirname "${BASH_SOURCE[0]}"`; cd ..; pwd)"
declare -a example_names
declare -a example_codes

function set_git {
  local from="$1"
  local to="$2"
  for example_name in `ls "$root/examples"`; do
    dir="$root/examples/$example_name"
    if [[ -e "$dir/$from" ]]; then
      mv "$dir/$from" "$dir/$to"
    fi
  done
}
function test_example {
  local example_name="$1"
  shift
  local example_path="$root/examples/$example_name"
  local args="$@ $example_path"
  echo "testing example \"$1\" (diff-package-lock $args)"
  "$root/index.js" $args
  exit_code=$?
  example_names+=($example_name)
  example_codes+=($exit_code)
}

function print_results {
  local name
  local code
  local i=0
  local exit_code=0
  echo
  while [[ $i -lt ${#example_names[@]} ]]; do
    name=${example_names[$i]:-none}
    code=${example_codes[$i]:-none}
    i=$(( i + 1 ))
    echo "[$name] exit code: $code"
    if [[ $code -gt 0 ]]; then
      exit_code=$code
    fi
  done
  if [[ $exit_code -gt 0 ]]; then
    echo "FAILURE"
  else
    echo "SUCCESS"
  fi
  echo
  exit $exit_code
}

function onexit {
  set_git .git git
}
trap onexit EXIT

set_git git .git
test_example basic react-15 react-16
test_example lerna react-15 react-16
test_example lerna lodash-4.0 lodash-4.1

print_results
