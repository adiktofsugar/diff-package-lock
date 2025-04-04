import type PackageDescriptor from "./PackageDescriptor";

export default class PackageChange {
  a: PackageDescriptor | undefined;
  b: PackageDescriptor | undefined;

  constructor(
    a: PackageDescriptor | undefined,
    b: PackageDescriptor | undefined,
  ) {
    this.a = a;
    this.b = b;
  }
}
