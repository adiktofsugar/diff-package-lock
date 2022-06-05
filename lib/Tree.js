const { EOL } = require("os");
const fs = require("fs");
const micromatch = require("micromatch");
const path = require("path");
const { promisify } = require("util");
const walkDir = require("./walkDir");
const PackageChange = require("./PackageChange");
const getRootLockSpec = require("./getRootLockSpec");
const execSync = require("./execSync");

const readFile = promisify(fs.readFile);

async function readJson(filepath) {
  const contents = await readFile(filepath, "utf-8");
  return JSON.parse(contents);
}

class Tree {
  constructor(treeish, options = {}) {
    const { cwd = process.cwd() } = options;
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
      }
    ).toString();
    if (!existingFiles) {
      throw error;
    }
    const stdout = execSync(`git show "${this.treeish}:${filepath}"`, {
      cwd: this.cwd,
    }).toString();
    return JSON.parse(stdout);
  }

  async getFilepaths(...globs) {
    if (this.treeish === "disk") {
      const match = (filepath) => {
        const relativePath = path.relative(this.cwd, filepath);
        const normalizedPath = relativePath.split(path.sep).join("/");
        return micromatch.isMatch(normalizedPath, globs);
      };
      return walkDir(this.cwd, match).map(
        (filepath) => `./${path.relative(this.cwd, filepath)}`
      );
    }
    // this should give me a list of filenames, and i'll filter with micromatch,
    //  which supports the same globs as globby
    const stdout = execSync(`git ls-tree --name-only -r "${this.treeish}"`, {
      cwd: this.cwd,
    }).toString();
    const filepaths = stdout.split(EOL);
    return micromatch(filepaths, globs).map((filepath) => `./${filepath}`);
  }

  async getLernaGlobs() {
    // if this is a lerna repo, we may need to include the child package.jsons as well
    try {
      const { packages: packageSpecs = ["packages/*"] } =
        await this.getJsonFile("./lerna.json");
      return packageSpecs;
    } catch (e) {
      if (e.code !== "NOT_FOUND") {
        throw e;
      }
      return [];
    }
  }

  async getGlobFilepaths(globs) {
    return this.getFilepaths(...globs.map((glob) => `${glob}/package.json`));
  }

  async getPackageFilepaths() {
    const rootFilepath = "./package.json";
    const pack = await this.getJsonFile(rootFilepath);
    const globs = [...(pack.workspaces || []), ...(await this.getLernaGlobs())];
    return [rootFilepath, ...(await this.getGlobFilepaths(globs))];
  }

  async getLockFile() {
    try {
      return await this.getJsonFile("./package-lock.json");
    } catch (e) {
      if (e.code !== "NOT_FOUND") throw e;
    }
    return this.getJsonFile("./npm-shrinkwrap.json");
  }

  async getPackages() {
    const [packageFilepaths, lock] = await Promise.all([
      this.getPackageFilepaths(),
      this.getLockFile(),
    ]);
    const packs = await Promise.all(
      packageFilepaths.map((filepath) => this.getJsonFile(filepath))
    );
    const allDependencyNames = [];
    packs.forEach((pack) => {
      [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ].forEach((depType) => {
        const deps = pack[depType];
        if (deps) {
          Object.keys(deps).forEach((depName) => {
            if (!allDependencyNames.includes(depName)) {
              allDependencyNames.push(depName);
            }
          });
        }
      });
    });
    const lockSpec = getRootLockSpec(lock);
    return allDependencyNames.map((name) =>
      this.getPackage(lockSpec.get(name))
    );
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
            .map((depLockSpec) => this.getPackage(depLockSpec)),
      };
    }
    return this.packages[id];
  }

  async getPackageChange(other) {
    const [myPackages, theirPackages] = await Promise.all([
      this.getPackages(),
      other.getPackages(),
    ]);
    return new PackageChange(
      "root",
      {
        version: null,
        getDependencies: () => myPackages,
      },
      {
        version: null,
        getDependencies: () => theirPackages,
      }
    );
  }
}
module.exports = Tree;
