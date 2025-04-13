#!/usr/bin/env tsx
import parseArgs from 'minimist';
import release, { CliError } from './lib/release.mjs';

const usage = `
release [-h][-n] [<ref>]
-h help
-n dry run
<ref> a git identifier, defaults to last (semver) tag

Release a new version based on changes since <ref>
Exits with 2 if no changes detected
`

const args = parseArgs(process.argv.slice(2), {
  boolean: ['help', 'dry-run'],
  alias: { h: 'help', n: 'dry-run' },
});

if (args.help) {
  console.log(usage);
  process.exit(0);
}

const [ref] = args._;
const dry = !!args['dry-run'];

try {
  release({ ref, dry, dirpath: process.cwd() });
} catch (e) {
  process.exitCode = 1;
  if (e instanceof CliError) {
    console.error(e.message);
  } else {
    console.error(e);
  }
}
