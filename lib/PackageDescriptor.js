module.exports = class PackageDescriptor {
  /**
   *
   * @param {string} key
   * @param {string} name
   * @param {string} version
   */
  constructor(key, name, version) {
    this.key = key;
    this.name = name;
    this.version = version;
  }
};
