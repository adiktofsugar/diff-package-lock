const _ = require("lodash");
const fs = require("fs-extra");
const execa = require("execa");
const path = require("path");
const PackageChange = require("./PackageChange");
const LockSpec = require("./LockSpec");

class Tree {
  constructor(treeish, options = {}) {
    const { cwd = process.cwd() } = options;
    this.treeish = treeish;
    this.cwd = cwd;
    this.packages = {};
  }

  async getFile(filepath) {
    if (this.treeish === "disk") {
      return fs.readJson(path.join(this.cwd, filepath));
    }
    const { stdout } = await execa(
      "git",
      ["show", `${this.treeish}:${filepath}`],
      { cwd: this.cwd }
    );
    return JSON.parse(stdout);
  }

  async getPackages() {
    const [pack, lock] = await Promise.all([
      this.getFile("package.json"),
      this.getFile("package-lock.json")
    ]);
    const allDependencyNames = _(Object.keys(pack))
      .filter(key => key.toLowerCase().endsWith("dependencies"))
      .map(key => Object.keys(pack[key]))
      .flatten()
      .uniq()
      .value();
    const lockSpec = new LockSpec("root", lock);
    return _(allDependencyNames)
      .map(key => this.getPackage(lockSpec.get(key)))
      .value();
  }

  getPackage(lockSpec) {
    const { name, version } = lockSpec;
    const id = `${name}@${version}`;
    if (!this.packages[id]) {
      this.packages[id] = {
        name,
        version,
        getDependencies: () =>
          lockSpec
            .getDependencies()
            .map(depLockSpec => this.getPackage(depLockSpec))
      };
    }
    return this.packages[id];
  }

  async getPackageChange(other) {
    const [myPackages, theirPackages] = await Promise.all([
      this.getPackages(),
      other.getPackages()
    ]);
    return new PackageChange(
      "root",
      {
        version: this.treeish,
        getDependencies: () => myPackages
      },
      {
        version: other.treeish,
        getDependencies: () => theirPackages
      },
      {
        isLast: true
      }
    );
  }
}
module.exports = Tree;
