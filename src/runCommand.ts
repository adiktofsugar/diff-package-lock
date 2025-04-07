import {
  type SpawnSyncOptions,
  type SpawnSyncReturns,
  spawnSync,
} from "child_process";

const KB = 1024;
const MB = 1024 * KB;

/**
 * A wrapper around spawnSync that provides more control over command execution
 * @param args Array of strings where the first element is the command and the rest are arguments
 * @param options Options for the spawned process
 * @returns The result of the command execution with standardized properties
 */
export default function runCommand(
  args: string[],
  options: SpawnSyncOptions = {},
): SpawnSyncReturns<Buffer> {
  if (args.length === 0) {
    throw new Error("Command array must not be empty");
  }

  const [command, ...commandArgs] = args;

  const defaultOptions: SpawnSyncOptions = {
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 100 * MB,
    ...options,
  };

  const result = spawnSync(command, commandArgs, defaultOptions);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stdout = result.stdout ? result.stdout.toString() : "";
    const stderr = result.stderr ? result.stderr.toString() : "";
    throw new Error(
      [
        `Command "${args.join(" ")}" failed with exit code ${result.status}`,
        stdout,
        stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result;
}
