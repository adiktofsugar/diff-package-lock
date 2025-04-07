import fs from "fs";
import { afterEach, beforeEach, describe, test } from "node:test";
import path from "path";
import expect from "expect";
import {
  TreeChangeAdd,
  TreeChangeKey,
  TreeChangeRemove,
  TreeChangeVersion,
} from "../TreeChange";
import type { LockFile, LockFileV2Packages } from "../interfaces";
import runCommand from "../runCommand";
import setupRamDisk, { type RamDiskResult } from "./setupRamDisk";

function makeLockFileV2(
  name: string,
  version: string,
  packages: LockFileV2Packages,
) {
  return {
    name,
    version,
    lockfileVersion: 2,
    packages: {
      "": {
        name,
        version,
      },
      ...packages,
    },
  };
}

let ramdisk: RamDiskResult;
beforeEach(() => {
  ramdisk = setupRamDisk();
  runCommand(["git", "init", "-b", "master"], { cwd: ramdisk.path });
});
afterEach(() => {
  ramdisk?.cleanup();
});

function outputFileSync(filepath: string, data: string) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, data);
}
function outputFilesSync(basedir: string, files: Record<string, string>) {
  for (const [filename, data] of Object.entries(files)) {
    outputFileSync(path.join(basedir, filename), data);
  }
}

describe("Tree", async () => {
  const { default: Tree } = await import("../Tree");

  describe("getJsonFile", () => {
    test("disk", async () => {
      const data = { name: "awesome" };
      outputFilesSync(ramdisk.path, {
        "data.json": JSON.stringify(data),
      });
      const tree = new Tree("disk", { cwd: ramdisk.path });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
    test("tree", async () => {
      const data = { name: "awesome" };
      outputFilesSync(ramdisk.path, {
        "data.json": JSON.stringify(data),
      });
      runCommand(["git", "checkout", "-b", "abc123"], { cwd: ramdisk.path });
      runCommand(["git", "add", "."], { cwd: ramdisk.path });
      runCommand(["git", "commit", "-m", "Initial commit"], {
        cwd: ramdisk.path,
      });

      const tree = new Tree("abc123", { cwd: ramdisk.path });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
  });
  describe("getLockFile", () => {
    test("only package-lock", async () => {
      const data = { name: "awesome" };
      outputFilesSync(ramdisk.path, {
        "package-lock.json": JSON.stringify(data),
      });
      const tree = new Tree("disk", { cwd: ramdisk.path });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(data);
    });
    test("only npm-shrinkwrap", async () => {
      const data = { name: "awesome" };
      outputFilesSync(ramdisk.path, {
        "npm-shrinkwrap.json": JSON.stringify(data),
      });
      const tree = new Tree("disk", { cwd: ramdisk.path });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(data);
    });
    test("both", async () => {
      const lock = { name: "awesome" };
      const shrink = { name: "cool" };
      outputFilesSync(ramdisk.path, {
        "package-lock.json": JSON.stringify(lock),
        "npm-shrinkwrap.json": JSON.stringify(shrink),
      });
      const tree = new Tree("disk", { cwd: ramdisk.path });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(lock);
    });
  });
  describe("getChanges", () => {
    async function getChanges(lockA: LockFile, lockB: LockFile) {
      runCommand(["git", "checkout", "-b", "initial"], { cwd: ramdisk.path });
      outputFileSync(
        path.join(ramdisk.path, "package-lock.json"),
        JSON.stringify(lockA),
      );
      runCommand(["git", "add", "."], { cwd: ramdisk.path });
      runCommand(["git", "commit", "-m", "initial"], { cwd: ramdisk.path });

      runCommand(["git", "checkout", "-b", "change"], { cwd: ramdisk.path });
      outputFileSync(
        path.join(ramdisk.path, "package-lock.json"),
        JSON.stringify(lockB),
      );
      runCommand(["git", "commit", "--allow-empty", "-am", "change"], {
        cwd: ramdisk.path,
      });
      const treeA = new Tree("initial", { cwd: ramdisk.path });
      const treeB = new Tree("change", { cwd: ramdisk.path });
      return treeA.getChanges(treeB);
    }
    test("none", async () => {
      const changes = await getChanges(
        makeLockFileV2("awesome", "1.0.0", {}),
        makeLockFileV2("awesome", "1.0.0", {}),
      );
      expect(changes).toEqual([]);
    });
    test("added", async () => {
      const changes = await getChanges(
        makeLockFileV2("awesome", "1.0.0", {}),
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/cool": { name: "cool", version: "1.0.0" },
        }),
      );
      expect(changes).toEqual([
        new TreeChangeAdd({
          key: "node_modules/cool",
          name: "cool",
          version: "1.0.0",
        }),
      ]);
    });
    test("removed", async () => {
      const changes = await getChanges(
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/cool": { name: "cool", version: "1.0.0" },
        }),
        makeLockFileV2("awesome", "1.0.0", {}),
      );
      expect(changes).toEqual([
        new TreeChangeRemove({
          key: "node_modules/cool",
          name: "cool",
          version: "1.0.0",
        }),
      ]);
    });
    test("changed version", async () => {
      const changes = await getChanges(
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/cool": { name: "cool", version: "1.0.0" },
        }),
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/cool": { name: "cool", version: "2.0.0" },
        }),
      );
      expect(changes).toEqual([
        new TreeChangeVersion(
          {
            key: "node_modules/cool",
            name: "cool",
            version: "1.0.0",
          },
          "2.0.0",
        ),
      ]);
    });
    test("changed key", async () => {
      const changes = await getChanges(
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/cool": { name: "cool", version: "1.0.0" },
        }),
        makeLockFileV2("awesome", "1.0.0", {
          "node_modules/packages/a/node_modules/cool": {
            name: "cool",
            version: "1.0.0",
          },
        }),
      );
      expect(changes).toEqual([
        new TreeChangeKey(
          {
            key: "node_modules/cool",
            name: "cool",
            version: "1.0.0",
          },
          "node_modules/packages/a/node_modules/cool",
        ),
      ]);
    });
  });
});
