import PackageChange from "./PackageChange";
import PackageDescriptor from "./PackageDescriptor";
import {
  type TreeChange,
  TreeChangeAdd,
  TreeChangeKey,
  TreeChangeRemove,
  TreeChangeVersion,
} from "./TreeChange";
import type {
  ErrorWithCode,
  LockFile,
  PackageMap,
  TreeOptions,
} from "./interfaces";
import readGitFile from "./readGitFile";
import sortChanges from "./sortChanges";
import { isErrorWithCode } from "./typeGuards";

export default class Tree {
  treeish: string;
  cwd: string;
  packages: PackageMap;

  constructor(treeish: string, { cwd }: TreeOptions) {
    this.treeish = treeish;
    this.cwd = cwd;
    this.packages = {};
  }

  async getJsonFile(filepath: string): Promise<unknown> {
    return JSON.parse(readGitFile(this.treeish, filepath, this.cwd).toString());
  }

  async getLockFile(): Promise<LockFile> {
    const errors: Error[] = [];
    for (const file of ["./package-lock.json", "./npm-shrinkwrap.json"]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return (await this.getJsonFile(file)) as LockFile;
      } catch (e) {
        if (isErrorWithCode(e) && e.code !== "NOT_FOUND") throw e;
        errors.push(e as Error);
      }
    }
    const error = new Error(
      errors.map((e) => e.message).join(", "),
    ) as ErrorWithCode;
    error.code = "NOT_FOUND";
    throw error;
  }

  async getPackages(): Promise<PackageMap> {
    const lock = await this.getLockFile();
    const { lockfileVersion = 1 } = lock;
    if (lockfileVersion === 1 && "dependencies" in lock) {
      return Object.entries(lock.dependencies).reduce<PackageMap>(
        (acc, [key, spec]) => {
          // in v1, the key is the name
          acc[key] = new PackageDescriptor(key, key, spec.version);
          return acc;
        },
        {},
      );
    }
    if ("packages" in lock) {
      return Object.entries(lock.packages).reduce<PackageMap>(
        (acc, [key, spec]) => {
          let name: string | undefined = undefined;

          // calculate name. this only gets the ones in node_modules, which excludes
          //   the ones in the root and workspaces
          if ("name" in spec) {
            name = spec.name;
          } else {
            const nmIndex = key.lastIndexOf("node_modules/");
            if (nmIndex !== -1) {
              name = key.slice(nmIndex + "node_modules/".length);
            }
          }
          if (name) {
            let version = "(unknown version)";
            if ("link" in spec) {
              version = `link:${spec.resolved}`;
            } else if (spec.version) {
              version = spec.version;
            }
            acc[key] = new PackageDescriptor(key, name, version);
          }
          return acc;
        },
        {},
      );
    }
    return {};
  }

  async getChanges(other: Tree): Promise<TreeChange[]> {
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
    const packageChanges: PackageChange[] = [];
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
    const removed = new Map<string, PackageDescriptor>();
    const added = new Map<string, PackageDescriptor>();
    const changes: TreeChange[] = packageChanges
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
        if (b) {
          added.set(`${b.name}@${b.version}`, b);
          // return new TreeChangeAdd(b);
        }
        return undefined;
      })
      .filter(Boolean) as TreeChange[];

    // at this point I have add, remove, and version, but not key changes, since those are
    //  an remove + add on the same name + version
    for (const nv of removed.keys()) {
      const pkgRemoved = removed.get(nv);
      const pkgAdded = added.get(nv);
      if (pkgRemoved && pkgAdded) {
        added.delete(nv);
        changes.push(new TreeChangeKey(pkgRemoved, pkgAdded.key));
      } else if (pkgRemoved) {
        changes.push(new TreeChangeRemove(pkgRemoved));
      }
    }
    for (const nv of added.keys()) {
      const pkgAdded = added.get(nv);
      if (pkgAdded) {
        changes.push(new TreeChangeAdd(pkgAdded));
      }
    }
    return sortChanges(changes);
  }
}
