import { stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Isolated fallback (RFC-005): return the first existing directory from
 * `candidates` (for example `["app", "src/app"]`), or `undefined` when none
 * exists.
 */
export async function findRouterDirectory(
  projectRoot: string,
  candidates: readonly string[],
): Promise<string | undefined> {
  for (const candidate of candidates) {
    const fullPath = join(projectRoot, candidate);

    if (await isDirectory(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
