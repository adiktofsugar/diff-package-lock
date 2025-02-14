class PackageChange {
  /**
   *
   * @param {import('./PackageDescriptor')} a
   * @param {import('./PackageDescriptor')} b
   */
  constructor(a, b) {
    this.a = a;
    this.b = b;
  }
}

module.exports = PackageChange;
