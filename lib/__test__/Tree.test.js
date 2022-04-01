const mockFs = require("mock-fs");
const mockGitRepo = require("./mockGitRepo");
const Tree = require("../Tree");

describe("Tree", () => {
  let pkg;
  let lock;
  afterEach(() => {
    mockFs.restore();
    mockGitRepo.restore();
  });
  beforeEach(() => {
    pkg = {
      name: "bob",
      version: "1.0.0",
      dependencies: {
        "some-thing": "1.0.0",
      },
    };
    lock = {
      name: "bob",
      version: "1.0.0",
      lockfileVersion: 1,
      dependencies: {
        "some-thing": {
          version: "1.0.0",
        },
      },
    };
  });

  describe("getJsonFile", () => {
    test("disk", async () => {
      mockFs({
        "/repo": {
          "package.json": JSON.stringify(pkg),
          "package-lock.json": JSON.stringify(lock),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getJsonFile("./package.json")).resolves.toEqual(pkg);
      await expect(tree.getJsonFile("./package-lock.json")).resolves.toEqual(
        lock
      );
    });
    test("tree", async () => {
      mockGitRepo({
        abc123: {
          "package.json": JSON.stringify(pkg),
          "package-lock.json": JSON.stringify(lock),
        },
      });
      // failing because I'm not modifying child_process quickly enough
      const tree = new Tree("abc123");
      const packageJson = await tree.getJsonFile("./package.json");
      expect(packageJson).toEqual(pkg);
      await expect(tree.getJsonFile("./package-lock.json")).resolves.toEqual(
        lock
      );
    });
  });
  describe("getLockFile", () => {
    test("only package-lock", async () => {
      mockFs({
        "/repo": {
          "package.json": JSON.stringify(pkg),
          "package-lock.json": JSON.stringify(lock),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toEqual(lock);
    });
    test("only npm-shrinkwrap", async () => {
      mockFs({
        "/repo": {
          "package.json": JSON.stringify(pkg),
          "npm-shrinkwrap.json": JSON.stringify(lock),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toEqual(lock);
    });
    test("both", async () => {
      mockFs({
        "/repo": {
          "package.json": JSON.stringify(pkg),
          "package-lock.json": JSON.stringify({ isPackageLock: true, ...lock }),
          "npm-shrinkwrap.json": JSON.stringify({
            isShrinkwrap: true,
            ...lock,
          }),
        },
      });
      const tree = new Tree("disk", { cwd: "/repo" });
      await expect(tree.getLockFile()).resolves.toMatchObject({
        isPackageLock: true,
      });
    });
  });
});
