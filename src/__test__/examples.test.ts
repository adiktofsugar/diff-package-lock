import { afterEach, beforeEach, test } from "node:test";
import path from "path";
import expect from "expect";
import Tree from "../Tree";
import runCommand from "../runCommand";
import setupRamDisk, { type RamDiskResult } from "./setupRamDisk";
import stringifyTreeChange from "./utils/stringifyTreeChange";

let ramdisk: RamDiskResult;
let projectRoot: string;

beforeEach(() => {
  ramdisk = setupRamDisk();
  projectRoot = path.resolve(__dirname, "..", "..");
});

afterEach(() => {
  ramdisk?.cleanup();
});

/**
 * Test a specific example repository
 * @param repoName Name of the repository (without .git extension)
 * @param fromRef The 'from' reference to compare
 * @param toRef The 'to' reference to compare
 * @returns The exit code from running diff-package-lock
 */
async function testExample(repoName: string, fromRef: string, toRef: string) {
  const repoPath = path.join(ramdisk.path, repoName);

  // Clone the bare repository
  runCommand([
    "git",
    "clone",
    path.join(projectRoot, "repos", `${repoName}.git`),
    repoPath,
  ]);
  const [a, b] = [
    new Tree(fromRef, { cwd: repoPath }),
    new Tree(toRef, { cwd: repoPath }),
  ];
  return a.getChanges(b);
}

test("basic repository: react-15 to react-16", async () => {
  const changes = await testExample(
    "basic",
    "origin/react-15",
    "origin/react-16",
  );
  expect(changes.map(stringifyTreeChange)).toEqual([
    "- asap@2.0.6",
    "- core-js@1.2.7",
    "- create-react-class@15.6.3",
    "- encoding@0.1.12",
    "- fbjs@0.8.17",
    "- iconv-lite@0.4.24",
    "- is-stream@1.1.0",
    "- isomorphic-fetch@2.2.1",
    "- node-fetch@1.7.3",
    "- promise@7.3.1",
    "* react@15.6.2 -> 16.13.0",
    "- safer-buffer@2.1.2",
    "- setimmediate@1.0.5",
    "- ua-parser-js@0.7.21",
    "- whatwg-fetch@3.0.0",
  ]);
});

test("lerna repository: lodash-4.0 to lodash-4.1", async () => {
  const changes = await testExample(
    "lerna",
    "origin/lodash-4.0",
    "origin/lodash-4.1",
  );
  expect(changes.map(stringifyTreeChange)).toEqual(["* lodash@4.0.1 -> 4.1.0"]);
});

test("workspaces repository: express-two to fs-extra-two", async () => {
  const changes = await testExample(
    "workspaces",
    "origin/express-two",
    "origin/fs-extra-two",
  );
  expect(changes.map(stringifyTreeChange)).toEqual([
    "+ node_modules/fs-extra@10.0.1",
    "+ node_modules/graceful-fs@4.2.9",
    "+ node_modules/jsonfile@6.1.0",
    "+ node_modules/universalify@2.0.0",
  ]);
});

test("no-change repository: add-lodash to add-new-file", async () => {
  const changes = await testExample(
    "no-change",
    "origin/add-lodash",
    "origin/add-new-file",
  );
  expect(changes.map(stringifyTreeChange)).toEqual([]);
});
