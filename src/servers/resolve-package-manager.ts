import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const LOCKFILES: ReadonlyArray<readonly [fileName: string, packageManager: PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
];

/**
 * Resolve the package manager for a project or workspace. The nearest
 * `packageManager` declaration wins, followed by the nearest recognized
 * lockfile. npm is the portable fallback for projects with neither.
 */
export function resolvePackageManager(workingDirectory: string): PackageManager {
  const directories: string[] = [];
  let directory = workingDirectory;

  while (true) {
    directories.push(directory);
    const parent = dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }

  for (const candidate of directories) {
    const declared = readDeclaredPackageManager(join(candidate, "package.json"));
    if (declared !== undefined) {
      return declared;
    }
  }

  for (const candidate of directories) {
    for (const [fileName, packageManager] of LOCKFILES) {
      if (existsSync(join(candidate, fileName))) {
        return packageManager;
      }
    }
  }

  return "npm";
}

function readDeclaredPackageManager(packageJsonPath: string): PackageManager | undefined {
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      readonly packageManager?: unknown;
    };
    if (typeof packageJson.packageManager !== "string") {
      return undefined;
    }

    const name = packageJson.packageManager.split("@", 1)[0];
    return isPackageManager(name) ? name : undefined;
  } catch {
    // Configuration loading/reporting owns malformed project manifests. A
    // nearby lockfile or npm fallback still gives startup a deterministic path.
    return undefined;
  }
}

function isPackageManager(value: string | undefined): value is PackageManager {
  return value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";
}
