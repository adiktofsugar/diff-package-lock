const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const PackageChange = require("./PackageChange");
const execSync = require("./execSync");
const PackageDescriptor = require("./PackageDescriptor");
const {
  TreeChangeAdd,
  TreeChangeVersion,
  TreeChangeKey,
  TreeChangeRemove,
} = require("./TreeChange");

const readFile = promisify(fs.readFile);

async function readJson(filepath) {
  const contents = await readFile(filepath, "utf-8");
  return JSON.parse(contents);
}

class Tree {
  constructor(treeish, { cwd }) {
    this.treeish = treeish;
    this.cwd = cwd;
    this.packages = {};
  }

  async getJsonFile(filepath) {
    const error = new Error(`${this.treeish}:${filepath} does not exist`);
    error.code = "NOT_FOUND";

    if (this.treeish === "disk") {
      const realpath = path.join(this.cwd, filepath);
      if (!fs.existsSync(realpath)) {
        throw error;
      }
      return readJson(realpath);
    }
    const existingFiles = execSync(
      `git ls-tree --name-only "${this.treeish}" -- "${filepath}"`,
      {
        cwd: this.cwd,
      },
    ).toString();
    if (!existingFiles) {
      throw error;
    }
    const stdout = execSync(`git show "${this.treeish}:${filepath}"`, {
      cwd: this.cwd,
    }).toString();
    return JSON.parse(stdout);
  }

  async getLockFile() {
    const errors = [];
    for (const file of ["./package-lock.json", "./npm-shrinkwrap.json"]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.getJsonFile(file);
      } catch (e) {
        if (e.code !== "NOT_FOUND") throw e;
        errors.push(e);
      }
    }
    const error = new Error(errors.map((e) => e.message).join(", "));
    error.code = "NOT_FOUND";
    throw error;
  }

  async getPackages() {
    const lock = await this.getLockFile();
    const { lockfileVersion = 1 } = lock;
    if (lockfileVersion === 1) {
      return Object.entries(lock.dependencies).reduce((acc, [key, spec]) => {
        // in v1, the key is the name
        acc[key] = new PackageDescriptor(key, key, spec.version);
        return acc;
      }, {});
    }
    return Object.entries(lock.packages).reduce((acc, [key, spec]) => {
      const { version } = spec;
      let name;
      if (spec.name) {
        name = spec.name;
      } else {
        const nmIndex = key.lastIndexOf("node_modules/");
        if (nmIndex !== -1) {
          name = key.slice(nmIndex + "node_modules/".length);
        }
      }
      acc[key] = new PackageDescriptor(key, name, version);
      return acc;
    }, {});
  }

  async getChanges(other) {
    const [myPackages, theirPackages] = await Promise.all([
      this.getPackages(),
      other.getPackages(),
    ]);
    // I want to be able to detect:
    // - rename (when node_modules/a -> node_modules/b/node_modules/a)
    // - version change
    // - add
    // - remove
    // Like git, renames should be remove + add, where the name + version is the same but the
    //   "key" is different
    const initial = new Set(Object.keys(myPackages));
    const remaining = new Set(Object.keys(theirPackages));
    const packageChanges = [];
    for (const key of initial) {
      remaining.delete(key);
      packageChanges.push(
        new PackageChange(myPackages[key], theirPackages[key]),
      );
    }
    for (const key of remaining) {
      packageChanges.push(
        new PackageChange(myPackages[key], theirPackages[key]),
      );
    }
    const removed = new Map();
    const added = new Map();
    const changes = packageChanges
      .map(({ a, b }) => {
        if (a && b) {
          if (a.version !== b.version) {
            return new TreeChangeVersion(a, b.version);
          }
          return undefined;
        }
        if (a) {
          removed.set(`${a.name}@${a.version}`, a);
          // return new TreeChangeRemove(a);
          return undefined;
        }
        added.set(`${b.name}@${b.version}`, b);
        // return new TreeChangeAdd(b);
        return undefined;
      })
      .filter(Boolean);

    // at this point I have add, remove, and version, but not key changes, since those are
    //  an remove + add on the same name + version
    for (const nv of removed.keys()) {
      const pkgRemoved = removed.get(nv);
      const pkgAdded = added.get(nv);
      if (pkgAdded) {
        added.delete(nv);
        changes.push(new TreeChangeKey(pkgRemoved, pkgAdded.key));
      } else {
        changes.push(new TreeChangeRemove(removed.get(nv)));
      }
    }
    for (const nv of added.keys()) {
      changes.push(new TreeChangeAdd(added.get(nv)));
    }
    return changes;
  }
}
module.exports = Tree;
