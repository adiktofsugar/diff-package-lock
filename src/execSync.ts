import cp from 'child_process';

const KB = 1024;
const MB = 1024 * KB;

export default function execSync(cmd: string, options: cp.ExecSyncOptions = {}): Buffer | string {
  if (!options.maxBuffer) {
    options.maxBuffer = 100 * MB;
  }
  return cp.execSync(cmd, options);
}
