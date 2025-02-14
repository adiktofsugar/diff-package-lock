const mockFs = require("mock-fs");
const mockGitRepo = require("./mockGitRepo");
const Tree = require("../Tree");
const {
  TreeChangeAdd,
  TreeChangeRemove,
  TreeChangeVersion,
  TreeChangeKey,
} = require("../TreeChange");

function makeLockFileV2(name, version, packages) {
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

describe("Tree", () => {
  afterEach(() => {
    mockFs.restore();
    mockGitRepo.restore();
  });

  describe("getJsonFile", () => {
    test("disk", async () => {
      const data = { name: "awesome" };
      mockFs({
        "/repo": {
          "data.json": JSON.stringify(data),
        },
      });
      // failing because I'm not modifying child_process quickly enough
      const tree = new Tree("disk", { cwd: "/repo" });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
    test("tree", async () => {
      const data = { name: "awesome" };
      mockGitRepo({
        abc123: {
          "data.json": JSON.stringify(data),
        },
      });
      // failing because I'm not modifying child_process quickly enough
      const tree = new Tree("abc123", { cwd: "/repo" });
      const retrieved = await tree.getJsonFile("./data.json");
      expect(retrieved).toEqual(data);
    });
  });
  describe("getLockFile", () => {
    test("only package-lock", async () => {
      const data = { name: "awesome" };
      mockFs({
        "/repo": {
          "package-lock.json": JSON.stringify(data),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toEqual(data);
    });
    test("only npm-shrinkwrap", async () => {
      const data = { name: "awesome" };
      mockFs({
        "/repo": {
          "npm-shrinkwrap.json": JSON.stringify(data),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toEqual(data);
    });
    test("both", async () => {
      const lock = { name: "awesome" };
      const shrink = { name: "cool" };
      mockFs({
        "/repo": {
          "package-lock.json": JSON.stringify(lock),
          "npm-shrinkwrap.json": JSON.stringify(shrink),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toMatchObject(lock);
    });
  });
  describe("getChanges", () => {
    async function getChanges(lockA, lockB) {
      mockFs({
        "/repoA": {
          "package-lock.json": JSON.stringify(lockA),
        },
        "/repoB": {
          "package-lock.json": JSON.stringify(lockB),
        },
      });
      const treeA = new Tree("disk", { cwd: "/repoA" });
      const treeB = new Tree("disk", { cwd: "/repoB" });
      return treeA.getChanges(treeB);
    }
    test("none", async () => {
      await expect(
        getChanges(
          makeLockFileV2("awesome", "1.0.0", {}),
          makeLockFileV2("awesome", "1.0.0", {})
        )
      ).resolves.toEqual([]);
    });
    test("added", async () => {
      await expect(
        getChanges(
          makeLockFileV2("awesome", "1.0.0", {}),
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/cool": { version: "1.0.0" },
          })
        )
      ).resolves.toEqual([
        new TreeChangeAdd({
          key: "node_modules/cool",
          name: "cool",
          version: "1.0.0",
        }),
      ]);
    });
    test("removed", async () => {
      await expect(
        getChanges(
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/cool": { version: "1.0.0" },
          }),
          makeLockFileV2("awesome", "1.0.0", {})
        )
      ).resolves.toEqual([
        new TreeChangeRemove({
          key: "node_modules/cool",
          name: "cool",
          version: "1.0.0",
        }),
      ]);
    });
    test("changed version", async () => {
      await expect(
        getChanges(
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/cool": { version: "1.0.0" },
          }),
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/cool": { version: "2.0.0" },
          })
        )
      ).resolves.toEqual([
        new TreeChangeVersion(
          {
            key: "node_modules/cool",
            name: "cool",
            version: "1.0.0",
          },
          "2.0.0"
        ),
      ]);
    });
    test("changed key", async () => {
      await expect(
        getChanges(
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/cool": { version: "1.0.0" },
          }),
          makeLockFileV2("awesome", "1.0.0", {
            "node_modules/packages/a/node_modules/cool": { version: "1.0.0" },
          })
        )
      ).resolves.toEqual([
        new TreeChangeKey(
          {
            key: "node_modules/cool",
            name: "cool",
            version: "1.0.0",
          },
          "node_modules/packages/a/node_modules/cool"
        ),
      ]);
    });
  });
});
