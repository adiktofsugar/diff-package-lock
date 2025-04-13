import { spawnSync, type SpawnSyncOptions } from 'child_process';
import semver from 'semver';
import fs from 'fs'
import path from 'path';

export class CliError extends Error { }
export interface Change {
  severity: 'major' | 'minor' | 'patch';
  message: string;
  hash: string;
}

export default function release({
  ref: specifiedRef,
  dry: isDry,
  dirpath,
}: {
  ref: string,
  dry?: boolean,
  dirpath: string,
}) {
  let ref: string = specifiedRef;
  if (!ref) {
    const tags = runCommand(['git', 'tag', '--list', 'v*'], { cwd: dirpath }).split('\n');
    const versions = tags.map(tag => tag.slice(1)).filter(tag => semver.valid(tag)).sort(semver.compare);
    const latest = versions.at(-1);
    if (!latest) {
      throw new CliError('Could not determine last semver version');
    }
    debug(`Latest version (semver sorted): ${latest}`);
    ref = `v${latest}`
  }
  const logs = runCommand(['git', 'log', '--pretty=format:%h %s', 'HEAD', `^${ref}`], { cwd: dirpath }).split('\n');
  const changes: Change[] = [];
  for (const line of logs) {
    const [hash, ...rest] = line.split(' ');
    const subject = rest.join(' ');
    const match = subject.match(/^([a-z]+?)(\(.+?\))?(!)?:\s*(.+)/);
    if (match) {
      const [_, level, scopeRaw, excl, messageRaw] = match;
      const scope = scopeRaw ? scopeRaw.slice(1, -1) : undefined;
      const message = messageRaw.trim();
      debug(`level: ${level}, scope: ${scope}, excl: ${excl}, message: ${message}`);
      let severity: 'major' | 'minor' | 'patch' | null = null;
      if (excl) {
        severity = 'major';
      } else if (level === 'feat') {
        severity = 'minor';
      } else if (level === 'fix') {
        severity = 'patch';
      }
      if (severity) {
        changes.push({
          severity,
          message,
          hash,
        })
      }
    }
  }
  const severityToIndex = {
    major: 3,
    minor: 2,
    patch: 1,
  } as const;
  const indexToSeverity = {
    3: 'major',
    2: 'minor',
    1: 'patch',
  } as const;
  const maxBumpIndex = changes.reduce<0 | 1 | 2 | 3>((acc, change) => {
    const index = severityToIndex[change.severity] || 0;
    return index > acc ? index : acc;
  }, 0);

  if (maxBumpIndex === 0) {
    console.log('No changes detected. Aborting.');
    return;
  }
  const maxBump = indexToSeverity[maxBumpIndex];
  const packageJsonFilepath = findClosestPackageJson(dirpath);
  const rootDirpath = path.dirname(packageJsonFilepath);
  const pkg = JSON.parse(fs.readFileSync(packageJsonFilepath, 'utf-8'));
  const changelogFilepath = path.join(rootDirpath, 'CHANGELOG.md');
  const currentVersion = pkg.version as string;
  const nextVersion = semver.inc(currentVersion, maxBump);
  const existingChangelog = fs.existsSync(changelogFilepath)
    ? fs.readFileSync(changelogFilepath, 'utf-8')
    : '';

  changes.sort((a, b) => {
    const aIndex = severityToIndex[a.severity] || 0;
    const bIndex = severityToIndex[b.severity] || 0;
    return aIndex - bIndex;
  });

  const now = new Date();
  let patch = `## [${nextVersion}](https://github.com/adiktofsugar/diff-package-lock/compare/v${currentVersion}...v${nextVersion}) (${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()})\n\n\n`;
  let currentSeverity = null;
  const severityToHeader = {
    major: '⚠ BREAKING CHANGES',
    minor: 'Features',
    patch: 'Bug Fixes',
  } as const;
  for (const change of changes) {
    if (change.severity !== currentSeverity) {
      currentSeverity = change.severity;
      patch += `### ${severityToHeader[change.severity]}\n`;
    }
    patch += `* ${change.message} (${change.hash})\n`;
  }
  if (isDry) {
    console.log(`New Changelog:\n===\n${patch}===`);
    console.log(`Bump level: ${maxBump}`);
    console.log(`Next version: ${nextVersion}`);
    return;
  }
  fs.writeFileSync(changelogFilepath, `${patch}${existingChangelog ? `\n\n${existingChangelog}` : ''}`, 'utf-8');
  // we need to prevent npm from making the tag / commit because it requires the workspace to be clean
  runCommand(['npm', 'version', `${nextVersion}`, '--no-git-tag-version'], { cwd: rootDirpath, stdio: 'inherit' });
  runCommand(['git', 'add', changelogFilepath], { cwd: rootDirpath, stdio: 'inherit' });
  runCommand(['git', 'add', packageJsonFilepath], { cwd: rootDirpath, stdio: 'inherit' });
  runCommand(['git', 'commit', '-m', `chore(release): ${nextVersion}`], { cwd: rootDirpath, stdio: 'inherit' });
  runCommand(['git', 'tag', `v${nextVersion}`], { cwd: rootDirpath, stdio: 'inherit' });
  console.log(`Release ${nextVersion} created, run git push --tags`);

}

function runCommand(args: string[], options?: SpawnSyncOptions) {
  const cmd = args.join(' ');
  const result = spawnSync(args[0], args.slice(1), options);
  if (result.error) {
    throw new CliError(`"${cmd}" error: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new CliError(`"${cmd}" exited with code ${result.status}`);
  }
  if (result.stdout) {
    return result.stdout.toString();
  }
  return '';
}

function findClosestPackageJson(dirpath: string) {
  let current = dirpath;
  let last = null;
  while (current !== last) {
    const filepath = path.join(current, 'package.json');
    if (fs.existsSync(filepath)) {
      return filepath;
    }
    last = current;
    current = path.dirname(current);
  }
  throw new Error(`Could not find package.json in ${dirpath} or any parent directory`);
}

function debug(...args: unknown[]) {
  console.error('[debug]', ...args);
}