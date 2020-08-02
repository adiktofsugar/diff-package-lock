const _ = require("lodash");
const { EOL } = require("os");
const fs = require("fs-extra");
const execa = require("execa");
const globby = require("globby");
const micromatch = require("micromatch");
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

  // note that the git root may or may not be the same as the cwd, which does need
  //  to have a package.json in it
  async getGitRoot() {
    const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"], {
      cwd: this.cwd
    });
    return stdout;
  }

  async getFile(filepath) {
    const error = new Error(`${this.treeish}:${filepath} does not exist`);
    error.code = "NOT_FOUND";

    if (this.treeish === "disk") {
      const realpath = path.join(this.cwd, filepath);
      if (!fs.existsSync(realpath)) {
        throw error;
      }
      return fs.readJson(realpath);
    }
    try {
      const { stdout } = await execa(
        "git",
        ["show", `${this.treeish}:${filepath}`],
        { cwd: this.cwd }
      );
      return JSON.parse(stdout);
    } catch (e) {
      // 'fatal: Path \'lerna.json\' does not exist in \'react-15\'',
      if (
        e.exitCode === 128 &&
        /^fatal: path .+ does not exist in .+/i.test(e.stderr)
      ) {
        throw error;
      }
      throw e;
    }
  }

  async getFilepaths(...globs) {
    if (this.treeish === "disk") {
      return globby(globs, { cwd: this.cwd });
    }
    // this should give me a list of filenames, and i'll filter with micromatch,
    //  which supports the same globs as globby
    const { stdout } = await execa(
      "git",
      ["ls-tree", "--name-only", "-r", this.treeish],
      { cwd: this.cwd }
    );
    const filepaths = stdout.split(EOL);
    return micromatch(filepaths, globs).map(filepath => `./${filepath}`);
  }

  async getLernaPacks() {
    // if this is a lerna repo, we may need to include the child package.jsons as well
    let packageSpecs;
    try {
      ({ packages: packageSpecs = ["packages/*"] } = await this.getFile(
        "./lerna.json"
      ));
    } catch (e) {
      if (e.code !== "NOT_FOUND") {
        throw e;
      }
      return [];
    }
    const packageFilepaths = await this.getFilepaths(
      ...packageSpecs.map(spec => `${spec}/package.json`)
    );
    const packs = await Promise.all(
      packageFilepaths.map(filepath => this.getFile(filepath))
    );
    return packs;
  }

  async getPackages() {
    const [rootPack, lock, lernaPacks] = await Promise.all([
      this.getFile("./package.json"),
      this.getFile("./package-lock.json"),
      this.getLernaPacks()
    ]);
    const packs = [rootPack, ...lernaPacks];
    const allDependencyNames = _(
      packs.map(pack =>
        _([
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "optionalDependencies"
        ])
          .filter(key => pack[key])
          .map(key => Object.keys(pack[key]))
          .flatten()
          .value()
      )
    )
      .flatten()
      .uniq()
      .value();
    const lockSpec = new LockSpec("root", lock);
    return allDependencyNames.map(name => this.getPackage(lockSpec.get(name)));
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
      }
    );
  }
}
module.exports = Tree;
