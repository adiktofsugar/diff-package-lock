#!/bin/bash
root="$(cd `dirname "${BASH_SOURCE[0]}"`; cd ..; pwd)"

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
  local example_path="$root/examples/$1"
  shift
  local args="$@ $example_path"
  "$root/index.js" $args
}

function onexit {
  set_git .git git
}
trap onexit EXIT

set_git git .git
test_example basic react-15 react-16
test_example lerna react-15 react-16
test_example lerna lodash-4.0 lodash-4.1
