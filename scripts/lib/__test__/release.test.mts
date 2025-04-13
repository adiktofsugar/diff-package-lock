import { spawnSync } from "child_process";
import fs from "fs";
import { afterEach, beforeEach, test } from "node:test";
import dedent from "dedent";
import { expect } from "expect";
import tmp from "tmp";
import release from "../release.mjs";

let tmpDir: tmp.DirResult;
beforeEach(() => {
  tmpDir = tmp.dirSync({ unsafeCleanup: true });
  spawnSync("git", ["init"], { cwd: tmpDir.name });
  spawnSync("git", ["config", "user.name", "Test"], { cwd: tmpDir.name });
  spawnSync("git", ["config", "user.email", "test@test.com"], {
    cwd: tmpDir.name,
  });
  fs.writeFileSync(
    `${tmpDir.name}/package.json`,
    JSON.stringify({
      name: "test",
      version: "1.0.0",
    }),
  );
  fs.writeFileSync(
    `${tmpDir.name}/CHANGELOG.md`,
    dedent`
      ## 1.0.0 (2020-1-1)


      ### Features
      * Started the project

    `,
  );
  spawnSync("git", ["add", "."], { cwd: tmpDir.name });
  spawnSync("git", ["commit", "-m", "initial"], { cwd: tmpDir.name });
  spawnSync("git", ["tag", "v1.0.0"], { cwd: tmpDir.name });
});
afterEach(() => {
  if (tmpDir) {
    tmpDir.removeCallback();
  }
});

test("basic", async (t) => {
  const now = new Date("2020-01-01T00:00:00");
  t.mock.timers.enable({ apis: ["Date"], now });
  fs.writeFileSync(`${tmpDir.name}/test.txt`, "test");
  spawnSync("git", ["add", "."], { cwd: tmpDir.name });
  spawnSync("git", ["commit", "-m", "feat: add a silly file"], {
    cwd: tmpDir.name,
  });

  await release({
    ref: "v1.0.0",
    dirpath: tmpDir.name,
  });
  const changelog = fs.readFileSync(`${tmpDir.name}/CHANGELOG.md`, "utf-8");
  expect(changelog.split("\n")).toEqual([
    "## [1.1.0](https://github.com/adiktofsugar/diff-package-lock/compare/v1.0.0...v1.1.0) (2020-1-1)",
    "",
    "",
    "### Features",
    expect.stringMatching(/^\* add a silly file \(.+?\)$/),
    "",
    "",
    "## 1.0.0 (2020-1-1)",
    "",
    "",
    "### Features",
    "* Started the project",
  ]);
});
