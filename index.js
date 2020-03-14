#!/usr/bin/env node
const path = require("path");
const meow = require("meow");
const Tree = require("./lib/Tree");

const cli = meow(
  `
  Usage
    $ diff-package-lock [treeish] [treeish]
  Options
    --directory, -d Directory to diff (defaults to cwd)
`,
  {
    flags: {
      directory: {
        type: "string",
        alias: "d"
      },
      help: {
        alias: "h"
      }
    }
  }
);
const args = cli.input.slice();

let cwd = process.cwd();
if (cli.flags.directory) {
  cwd = path.resolve(cwd, cli.flags.directory);
}
let tree1 = "head";
let tree2 = "disk";
if (args.length === 2) {
  [tree1, tree2] = args;
} else if (args.length === 1) {
  [tree1] = args;
}

// console.log(`diff from ${tree1} to ${tree2} using cwd ${cwd}`);
async function go() {
  const [fromTree, toTree] = [tree1, tree2].map(t => new Tree(t, { cwd }));
  const packageChange = await fromTree.getPackageChange(toTree);
  packageChange.print();
}
go().catch(e => {
  console.error(e);
  process.exit(1);
});
