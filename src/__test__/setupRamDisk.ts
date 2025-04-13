import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * Information about the created RAM disk
 */
export interface RamDiskResult {
  /** Path to the mount point of the RAM disk */
  path: string;
  /** Function to clean up the RAM disk */
  cleanup: () => boolean;
}

/**
 * Creates an in-memory filesystem for Linux
 */
function setupLinuxRamDisk(uniqueName: string): RamDiskResult {
  const dirPath = path.join("/dev/shm", uniqueName);
  fs.mkdirSync(dirPath, { recursive: true });

  return {
    path: dirPath,
    cleanup: () => {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        return true;
      } catch (error) {
        console.error(`Failed to clean up directory at ${dirPath}:`, error);
        return false;
      }
    },
  };
}

/**
 * Creates an in-memory filesystem for macOS
 */
function setupMacRamDisk(uniqueName: string): RamDiskResult {
  const sectors = 512 * 2048; // 512MB = 1048576 sectors

  try {
    const devicePath = execSync(`hdiutil attach -nomount ram://${sectors}`)
      .toString()
      .trim();
    execSync(`diskutil erasevolume HFS+ "${uniqueName}" ${devicePath}`);
    const mountPath = `/Volumes/${uniqueName}`;

    return {
      path: mountPath,
      cleanup: () => {
        try {
          execSync(`hdiutil detach ${devicePath}`);
          return true;
        } catch (error) {
          console.error(`Failed to clean up RAM disk at ${devicePath}:`, error);
          return false;
        }
      },
    };
  } catch (e) {
    console.error(
      "Failed to create RAM disk on macOS, falling back to temporary directory.",
      e,
    );
    return setupFallbackRamDisk(uniqueName);
  }
}

/**
 * Creates an in-memory filesystem for Windows or other platforms
 */
function setupFallbackRamDisk(uniqueName: string): RamDiskResult {
  const tmpPath = path.join(os.tmpdir(), uniqueName);
  fs.mkdirSync(tmpPath, { recursive: true });

  return {
    path: tmpPath,
    cleanup: () => {
      try {
        fs.rmSync(tmpPath, { recursive: true, force: true });
        return true;
      } catch (error) {
        console.error(
          `Failed to clean up temp directory at ${tmpPath}:`,
          error,
        );
        return false;
      }
    },
  };
}

/**
 * Creates an in-memory filesystem
 * Uses /dev/shm on Linux, RAM disk on macOS, and falls back to a temp directory on Windows
 * Does not require sudo permissions
 *
 * @returns Object with path and cleanup function
 */
export default function setupRamDisk(): RamDiskResult {
  const uniqueName = `ramdisk-${uuidv4().substring(0, 8)}`;
  const platform = os.platform();

  if (platform === "linux") {
    return setupLinuxRamDisk(uniqueName);
  }
  if (platform === "darwin") {
    return setupMacRamDisk(uniqueName);
  }
  return setupFallbackRamDisk(uniqueName);
}
