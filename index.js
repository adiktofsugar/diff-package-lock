#!/usr/bin/env node
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const meow = require("meow");
const Tree = require("./lib/Tree");

const cli = meow(
  `
  Usage
    $ diff-package-lock [treeish] [treeish] [directory]
  Options
    --printed         Show printed dependencies a second time (default: true)
`,
  {
    flags: {
      printed: {
        type: "boolean",
        default: true
      },
      help: {
        alias: "h"
      }
    }
  }
);
const args = cli.input.slice();

let cwd = process.cwd();
let tree1 = "head";
let tree2 = "disk";

// the last argument MIGHT be a directory
const lastArg = _.last(args);
if (lastArg) {
  const possibleCwd = path.join(cwd, lastArg);
  if (fs.existsSync(possibleCwd)) {
    cwd = args.pop();
  }
}

if (args.length === 2) {
  [tree1, tree2] = args;
} else if (args.length === 1) {
  [tree1] = args;
}

// console.log(`diff from ${tree1} to ${tree2} using cwd ${cwd}`);
async function go() {
  const [fromTree, toTree] = [tree1, tree2].map(t => new Tree(t, { cwd }));
  const packageChange = await fromTree.getPackageChange(toTree);
  packageChange.print({ showPrinted: cli.flags.printed });
}
go().catch(e => {
  console.error(e);
  process.exit(1);
});
