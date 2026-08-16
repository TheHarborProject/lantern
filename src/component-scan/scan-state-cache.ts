import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ScanStateCache } from "../types/component-scan.js";
import { SCAN_STATE_CACHE_PATH } from "./artifact-paths.js";
import { writeJsonArtifact } from "./write-json-artifact.js";

export { SCAN_STATE_CACHE_PATH };

/**
 * Read the change-detection cache written by a previous `lantern lint` run.
 * Never throws: a missing, unreadable, or structurally invalid cache is
 * reported as `undefined` so callers can safely fall back to a full rescan
 * (RFC-007) instead of crashing on corrupt internal state.
 */
export function readScanStateCache(root: string): ScanStateCache | undefined {
  try {
    const raw = readFileSync(join(root, SCAN_STATE_CACHE_PATH), "utf-8");
    const data = JSON.parse(raw) as unknown;
    return isScanStateCache(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

/** Atomically persist the change-detection cache. */
export function writeScanStateCache(root: string, cache: ScanStateCache): string {
  return writeJsonArtifact(root, SCAN_STATE_CACHE_PATH, cache);
}

export type ScanChangeReason =
  | "no-previous-cache"
  | "corrupt-cache"
  | "files-changed"
  | "unchanged";

export interface ScanChangeDetectionResult {
  readonly changed: boolean;
  readonly reason: ScanChangeReason;
}

/**
 * Compare the current source hashes against the previous cache. Any
 * ambiguity (missing/corrupt cache) is reported as `changed: true` so callers
 * always default to the safe, correct full rescan rather than risking a
 * silently stale result (RFC-007).
 */
export function detectChangedSourceFiles(
  currentHashes: Readonly<Record<string, string>>,
  previous: ScanStateCache | undefined,
): ScanChangeDetectionResult {
  if (previous === undefined) {
    return { changed: true, reason: "no-previous-cache" };
  }

  const currentPaths = Object.keys(currentHashes);
  const previousPaths = Object.keys(previous.sourceHashes);

  if (currentPaths.length !== previousPaths.length) {
    return { changed: true, reason: "files-changed" };
  }

  for (const path of currentPaths) {
    if (previous.sourceHashes[path] !== currentHashes[path]) {
      return { changed: true, reason: "files-changed" };
    }
  }

  return { changed: false, reason: "unchanged" };
}

function isScanStateCache(data: unknown): data is ScanStateCache {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as { version?: unknown; sourceHashes?: unknown };
  return (
    candidate.version === 1 &&
    typeof candidate.sourceHashes === "object" &&
    candidate.sourceHashes !== null &&
    Object.values(candidate.sourceHashes).every((value) => typeof value === "string")
  );
}
