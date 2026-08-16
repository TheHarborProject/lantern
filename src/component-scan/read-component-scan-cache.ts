import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import { COMPONENT_SCAN_CACHE_PATH } from "./artifact-paths.js";

/**
 * Read the cached canonical component model written by a previous scan.
 * Never throws: a missing, unreadable, or structurally invalid cache is
 * reported as `undefined` so callers safely fall back to rescanning (RFC-007)
 * rather than trusting corrupt internal state.
 */
export function readComponentScanCache(root: string): CanonicalComponentModel | undefined {
  try {
    const raw = readFileSync(join(root, COMPONENT_SCAN_CACHE_PATH), "utf-8");
    const data = JSON.parse(raw) as unknown;
    return isCanonicalComponentModel(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

function isCanonicalComponentModel(data: unknown): data is CanonicalComponentModel {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as { version?: unknown; components?: unknown; diagnostics?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.components) && Array.isArray(candidate.diagnostics);
}
