#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Tree = require("./lib/Tree");

const usage = `
usage: diff-package-lock [-h|--help][-x|--exclude name][--printed][--exit-code][--depth|-d depth] [<from>][<to>][<path>]

Options
  --help, -h        Show help
  --printed         Show printed dependencies a second time (default: true)
  --exclude, -x     Exclude packages from highest found level. Repeat for more.
  --exit-code       Exit with exit code similar to diff (1 for changes, 0 for none)
  --depth, -d       Specify number of times to recurse into dependency trees

Arguments
  from Commitish to start from (default "HEAD")
  to   Commitish to end at (default "disk")
  path Path to diff (default to cwd)
      NOTE: this doesn't work like git diff and filter, it's specifiying the
        root directory we read the package.json and package-lock.json files from
`;

// eslint-disable-next-line import/order
const argv = require("minimist")(process.argv.slice(2), {
  boolean: ["help", "printed", "exit-code"],
  alias: {
    h: "help",
    x: "exclude",
    d: "depth",
  },
});

const args = argv._;
if (argv.help) {
  console.log(usage);
  process.exit();
}

let cwd = process.cwd();
let tree1 = "HEAD";
let tree2 = "disk";

// the last argument MIGHT be a directory
const lastArg = args.length ? args[args.length - 1] : null;
if (lastArg) {
  const possibleCwd = path.isAbsolute(lastArg)
    ? lastArg
    : path.join(cwd, lastArg);
  if (fs.existsSync(possibleCwd)) {
    cwd = args.pop();
  }
}

if (args.length === 2) {
  [tree1, tree2] = args;
} else if (args.length === 1) {
  [tree1] = args;
}

async function go() {
  const [fromTree, toTree] = [tree1, tree2].map((t) => new Tree(t, { cwd }));
  const packageChange = await fromTree.getPackageChange(toTree);
  packageChange.printDependencyChanges({
    maxDepth: argv.depth,
    exclude: argv.exclude,
    showPrinted: argv.printed,
  });
  if (packageChange.checkHasPrintableDependencyChanges() && argv["exit-code"]) {
    process.exit(1);
  }
}
go().catch((e) => {
  console.error(e);
  process.exit(1);
});
