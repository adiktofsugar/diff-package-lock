import execSync from "./execSync";
import fs from "fs";
import path from 'path';
import type { ErrorWithCode } from "./interfaces";

export default function readGitFile(treeish: string, filepath: string, cwd: string): Buffer {
  const error = new Error(`${treeish}:${filepath} does not exist`) as ErrorWithCode;
  error.code = 'NOT_FOUND';

  if (treeish === 'disk') {
    const realpath = path.join(cwd, filepath);
    if (!fs.existsSync(realpath)) {
      throw error;
    }
    return fs.readFileSync(realpath);
  }
  const existingFiles = execSync(
    `git ls-tree --name-only "${treeish}" -- "${filepath}"`,
    {
      cwd,
    },
  ).toString();
  if (!existingFiles) {
    throw error;
  }
  return execSync(`git show "${treeish}:${filepath}"`, {
    cwd,
    encoding: 'buffer',
  }) as Buffer;
}