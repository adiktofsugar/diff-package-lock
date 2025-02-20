/* eslint-disable max-classes-per-file */
const colorize = require("./colorize");

class TreeChangeAdd {
  /**
   *
   * @param {import('./PackageDescriptor')} pkg
   */
  constructor(pkg) {
    this.pkg = pkg;
  }

  toString() {
    return colorize("green", `${this.pkg.key}@${this.pkg.version}`);
  }
}
class TreeChangeRemove {
  /**
   *
   * @param {import('./PackageDescriptor')} pkg
   */
  constructor(pkg) {
    this.pkg = pkg;
  }

  toString() {
    return colorize("red", `${this.pkg.key}@${this.pkg.version}`);
  }
}
class TreeChangeVersion {
  /**
   *
   * @param {import('./PackageDescriptor')} pkg
   * @param {string} toVersion
   */
  constructor(pkg, toVersion) {
    this.pkg = pkg;
    this.toVersion = toVersion;
  }

  toString() {
    return colorize(
      "yellow",
      `${this.pkg.key}@${this.pkg.version} -> ${this.toVersion}`,
    );
  }
}
class TreeChangeKey {
  /**
   *
   * @param {import('./PackageDescriptor')} pkg
   * @param {string} toKey
   */
  constructor(pkg, toKey) {
    this.pkg = pkg;
    this.toKey = toKey;
  }

  toString() {
    return colorize("yellow", `${this.pkg.key} -> ${this.toKey}`);
  }
}

module.exports = {
  TreeChangeAdd,
  TreeChangeRemove,
  TreeChangeVersion,
  TreeChangeKey,
};
