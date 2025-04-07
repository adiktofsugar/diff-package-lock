import { afterEach, beforeEach, test } from "node:test";
import path from "path";
import expect from "expect";
import Tree from "../Tree";
import {
  TreeChangeAdd,
  TreeChangeRemove,
  TreeChangeVersion,
} from "../TreeChange";
import runCommand from "../runCommand";
import setupRamDisk, { type RamDiskResult } from "./setupRamDisk";

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
  expect(changes).toEqual([
    new TreeChangeVersion(
      {
        key: "react",
        name: "react",
        version: "15.6.2",
      },
      "16.13.0",
    ),
    new TreeChangeRemove({
      key: "asap",
      name: "asap",
      version: "2.0.6",
    }),
    new TreeChangeRemove({
      key: "core-js",
      name: "core-js",
      version: "1.2.7",
    }),
    new TreeChangeRemove({
      key: "create-react-class",
      name: "create-react-class",
      version: "15.6.3",
    }),
    new TreeChangeRemove({
      key: "encoding",
      name: "encoding",
      version: "0.1.12",
    }),
    new TreeChangeRemove({
      key: "fbjs",
      name: "fbjs",
      version: "0.8.17",
    }),
    new TreeChangeRemove({
      key: "iconv-lite",
      name: "iconv-lite",
      version: "0.4.24",
    }),
    new TreeChangeRemove({
      key: "is-stream",
      name: "is-stream",
      version: "1.1.0",
    }),
    new TreeChangeRemove({
      key: "isomorphic-fetch",
      name: "isomorphic-fetch",
      version: "2.2.1",
    }),
    new TreeChangeRemove({
      key: "node-fetch",
      name: "node-fetch",
      version: "1.7.3",
    }),
    new TreeChangeRemove({
      key: "promise",
      name: "promise",
      version: "7.3.1",
    }),
    new TreeChangeRemove({
      key: "safer-buffer",
      name: "safer-buffer",
      version: "2.1.2",
    }),
    new TreeChangeRemove({
      key: "setimmediate",
      name: "setimmediate",
      version: "1.0.5",
    }),
    new TreeChangeRemove({
      key: "ua-parser-js",
      name: "ua-parser-js",
      version: "0.7.21",
    }),
    new TreeChangeRemove({
      key: "whatwg-fetch",
      name: "whatwg-fetch",
      version: "3.0.0",
    }),
  ]);
});

test("lerna repository: lodash-4.0 to lodash-4.1", async () => {
  const changes = await testExample(
    "lerna",
    "origin/lodash-4.0",
    "origin/lodash-4.1",
  );
  expect(changes).toEqual([
    new TreeChangeVersion(
      {
        key: "lodash",
        name: "lodash",
        version: "4.0.1",
      },
      "4.1.0",
    ),
  ]);
});

test("workspaces repository: express-two to fs-extra-two", async () => {
  const changes = await testExample(
    "workspaces",
    "origin/express-two",
    "origin/fs-extra-two",
  );
  expect(changes).toEqual([
    new TreeChangeAdd({
      key: "node_modules/fs-extra",
      name: "fs-extra",
      version: "10.0.1",
    }),
    new TreeChangeAdd({
      key: "node_modules/graceful-fs",
      name: "graceful-fs",
      version: "4.2.9",
    }),
    new TreeChangeAdd({
      key: "node_modules/jsonfile",
      name: "jsonfile",
      version: "6.1.0",
    }),
    new TreeChangeAdd({
      key: "node_modules/universalify",
      name: "universalify",
      version: "2.0.0",
    }),
  ]);
});

test("no-change repository: add-lodash to add-new-file", async () => {
  const changes = await testExample(
    "no-change",
    "origin/add-lodash",
    "origin/add-new-file",
  );
  expect(changes).toEqual([]);
});
