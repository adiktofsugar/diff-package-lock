import test, { mock, afterEach, describe } from 'node:test';
import { createFsFromVolume, vol, Volume } from 'memfs';
import {
  TreeChangeAdd,
  TreeChangeRemove,
  TreeChangeVersion,
  TreeChangeKey,
} from "../TreeChange";
import expect from 'expect';
import type { ErrorWithCode, LockFile, LockFileV2Packages } from '../interfaces';
import path from 'path';

let treeishToVol: Record<string, typeof vol> = {};
function mockReadGitFile(treeish: string, filepath: string, cwd: string): Buffer {
  const vol = treeishToVol[treeish];
  if (!vol) {
    throw new Error(`No volume for ${treeish}`);
  }
  const realpath = path.join(cwd, filepath);
  const fs = createFsFromVolume(vol);
  if (!fs.existsSync(realpath)) {
    const error = new Error(`${treeish}:${filepath} does not exist`) as ErrorWithCode;
    error.code = 'NOT_FOUND';
    throw error;
  }
  return fs.readFileSync(realpath, { encoding: 'buffer' }) as Buffer;
}
mock.module(
  "../readGitFile",
  { defaultExport: mockReadGitFile },
);

function makeLockFileV2(name: string, version: string, packages: LockFileV2Packages) {
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

describe("Tree", async () => {
  const { default: Tree } = await import("../Tree");
  afterEach(() => {
    vol.reset()
  });

  describe("getJsonFile", () => {
    test("disk", async () => {
      const data = { name: "awesome" };
      treeishToVol = {
        disk: Volume.fromJSON({
          "/repo/data.json": JSON.stringify(data),
        })
      }
      const tree = new Tree("disk", { cwd: "/repo" });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
    test("tree", async () => {
      const data = { name: "awesome" };
      treeishToVol = {
        abc123: Volume.fromJSON({
          "/repo/data.json": JSON.stringify(data),
        }),
      }
      const tree = new Tree("abc123", { cwd: "/repo" });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
  });
  describe("getLockFile", () => {
    test("only package-lock", async () => {
      const data = { name: "awesome" };
      treeishToVol = {
        disk: Volume.fromJSON({
          "/repo/package-lock.json": JSON.stringify(data),
        })
      }
      const tree = new Tree("disk", { cwd: "/repo" });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(data);
    });
    test("only npm-shrinkwrap", async () => {
      const data = { name: "awesome" };
      treeishToVol = {
        disk: Volume.fromJSON({
          "/repo/npm-shrinkwrap.json": JSON.stringify(data),
        }),
      }
      const tree = new Tree("disk", { cwd: "/repo" });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(data);
    });
    test("both", async () => {
      const lock = { name: "awesome" };
      const shrink = { name: "cool" };
      treeishToVol = {
        disk: Volume.fromJSON({
          "/repo/package-lock.json": JSON.stringify(lock),
          "/repo/npm-shrinkwrap.json": JSON.stringify(shrink),
        }),
      }
      const tree = new Tree("disk", { cwd: "/repo" });
      const retrieved = await tree.getLockFile();
      expect(retrieved).toEqual(lock);
    });
  });
  describe("getChanges", () => {
    async function getChanges(lockA: LockFile, lockB: LockFile) {
      treeishToVol = {
        disk: Volume.fromJSON({
          "/repoA/package-lock.json": JSON.stringify(lockA),
          "/repoB/package-lock.json": JSON.stringify(lockB),
        }),
      }
      const treeA = new Tree("disk", { cwd: "/repoA" });
      const treeB = new Tree("disk", { cwd: "/repoB" });
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
          "node_modules/packages/a/node_modules/cool": { name: "cool", version: "1.0.0" },
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
