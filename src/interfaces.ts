import type PackageDescriptor from "./PackageDescriptor";

// From colorize.ts
export type AnsiColor =
  | "reset"
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray";

// From Tree.ts
export interface TreeOptions {
  cwd: string;
}

export interface PackageMap {
  [key: string]: PackageDescriptor;
}

export interface LockFileV1 {
  dependencies: {
    [key: string]: {
      version: string;
    };
  };
  lockfileVersion?: number;
}

export interface LockFileV2PackageNormal {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
}

export interface LockFileV2PackageLink {
  link: true;
  resolved: string;
}

export interface LockFileV2Packages {
  [key: string]: LockFileV2PackageNormal | LockFileV2PackageLink;
}

export interface LockFileV2 {
  packages: LockFileV2Packages;
  lockfileVersion?: number;
}

export type LockFile = LockFileV1 | LockFileV2;

export interface ErrorWithCode extends Error {
  code: string;
}

// From index.ts
export interface ArgvOptions {
  help: boolean;
  h: boolean;
  "exit-code": boolean;
  json: boolean;
  _: string[];
  [key: string]: unknown;
}
