import test from "node:test";
import expect from "expect";
import { TreeChangeAdd } from "../TreeChange";
import sortChanges from "../sortChanges";
import stringifyTreeChange from "./utils/stringifyTreeChange";

test("directories are grouped together", () => {
  const changes = [
    "node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/scope-manager@6.21.0",
    "node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/types@6.21.0",
    "node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/typescript-estree@6.21.0",
    "node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/visitor-keys@6.21.0",
    "node_modules/@typescript-eslint/type-utils/node_modules/brace-expansion@2.0.1",
    "node_modules/@typescript-eslint/type-utils/node_modules/debug@4.3.7",
    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore@5.3.2",
    "node_modules/@typescript-eslint/type-utils/node_modules/minimatch@9.0.3",
    "node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/utils@6.21.0",
    "node_modules/@typescript-eslint/type-utils/node_modules/ms@2.1.3",
    "node_modules/@typescript-eslint/type-utils/node_modules/semver@7.6.3",
  ].map((keyAndVersion) => {
    const atIndex = keyAndVersion.lastIndexOf("@");
    const key = keyAndVersion.slice(0, atIndex);
    const version = keyAndVersion.slice(atIndex + 1);
    const nmIndex = key.lastIndexOf("node_modules/");
    const name =
      nmIndex >= 0 ? key.slice(nmIndex + "node_modules/".length) : key;
    return new TreeChangeAdd({
      key,
      name,
      version,
    });
  });
  const sorted = sortChanges(changes);
  expect(sorted.map(stringifyTreeChange)).toEqual([
    "+ node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore@5.3.2",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/scope-manager@6.21.0",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/types@6.21.0",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/typescript-estree@6.21.0",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/utils@6.21.0",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/@typescript-eslint/visitor-keys@6.21.0",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/brace-expansion@2.0.1",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/debug@4.3.7",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/minimatch@9.0.3",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/ms@2.1.3",
    "+ node_modules/@typescript-eslint/type-utils/node_modules/semver@7.6.3",
  ]);
});
