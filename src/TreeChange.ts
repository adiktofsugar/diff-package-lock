import type PackageDescriptor from "./PackageDescriptor";
import colorize from "./colorize";

export class TreeChangeAdd {
  pkg: PackageDescriptor;

  constructor(pkg: PackageDescriptor) {
    this.pkg = pkg;
  }

  toString(): string {
    return colorize("green", `${this.pkg.key}@${this.pkg.version}`);
  }
}

export class TreeChangeRemove {
  pkg: PackageDescriptor;

  constructor(pkg: PackageDescriptor) {
    this.pkg = pkg;
  }

  toString(): string {
    return colorize("red", `${this.pkg.key}@${this.pkg.version}`);
  }
}

export class TreeChangeVersion {
  pkg: PackageDescriptor;
  toVersion: string;

  constructor(pkg: PackageDescriptor, toVersion: string) {
    this.pkg = pkg;
    this.toVersion = toVersion;
  }

  toString(): string {
    return colorize(
      "yellow",
      `${this.pkg.key}@${this.pkg.version} -> ${this.toVersion}`,
    );
  }
}

export class TreeChangeKey {
  pkg: PackageDescriptor;
  toKey: string;

  constructor(pkg: PackageDescriptor, toKey: string) {
    this.pkg = pkg;
    this.toKey = toKey;
  }

  toString(): string {
    return colorize("yellow", `${this.pkg.key} -> ${this.toKey}`);
  }
}

export type TreeChange =
  | TreeChangeAdd
  | TreeChangeRemove
  | TreeChangeVersion
  | TreeChangeKey;
