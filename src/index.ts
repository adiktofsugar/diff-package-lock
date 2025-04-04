#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';
import Tree from './Tree';
import type { ArgvOptions } from './interfaces';

const usage = `
usage: diff-package-lock [-h|--help][--exit-code] [<from>][<to>][<path>]

Options
  --help, -h        Show help
  --exit-code       Exit with exit code similar to diff (1 for changes, 0 for none)

Arguments
  from Commitish to start from (default "HEAD")
  to   Commitish to end at (default "disk")
  path Path to diff (default to cwd)
      NOTE: this doesn't work like git diff and filter, it's specifiying the
        root directory we read the package-lock.json file from
`;


// eslint-disable-next-line import/order
const argv = minimist<ArgvOptions>(process.argv.slice(2), {
  boolean: ['help', 'exit-code'],
  alias: {
    h: 'help',
  },
});

const args = argv._;
if (argv.help) {
  console.log(usage);
  process.exit(0);
}

let cwd = process.cwd();
let tree1 = 'HEAD';
let tree2 = 'disk';

// the last argument MIGHT be a directory
const lastArg = args.length ? args[args.length - 1] : null;
if (lastArg) {
  const possibleCwd = path.isAbsolute(lastArg)
    ? lastArg
    : path.join(cwd, lastArg);
  if (fs.existsSync(possibleCwd)) {
    cwd = args.pop() as string;
  }
}

if (args.length === 2) {
  [tree1, tree2] = args;
} else if (args.length === 1) {
  [tree1] = args;
}

async function go(): Promise<void> {
  const [fromTree, toTree] = [tree1, tree2].map((t) => new Tree(t, { cwd }));
  const changes = await fromTree.getChanges(toTree);
  for (const change of changes) {
    console.log(` - ${change.toString()}`);
  }
  if (argv['exit-code'] && changes.length) {
    process.exit(1);
  }
}

go().catch((e) => {
  console.error(e);
  process.exit(1);
});
