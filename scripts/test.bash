#!/bin/bash

root="$(cd `dirname "${BASH_SOURCE[0]}"`; cd ..; pwd)"
declare -a example_names
declare -a example_codes

dirpath="$(mktemp -d)"


function test_example {
  local example_name="$1"
  shift
  local example_path="$dirpath/$example_name"
  local args="$@ $example_path"
  echo "testing example \"$1\" (diff-package-lock $args)"
  git clone "$root/repos/$example_name.git" "$example_path"
  node "$root/dist/index.js" $args
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
  rm -rf "$dirpath"
}
trap onexit EXIT

test_example basic origin/react-15 origin/react-16
test_example lerna origin/lodash-4.0 origin/lodash-4.1
test_example workspaces origin/express-two origin/fs-extra-two
test_example no-change origin/add-lodash origin/add-new-file

print_results
