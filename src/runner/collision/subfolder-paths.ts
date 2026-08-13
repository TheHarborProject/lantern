import { basename, dirname, join } from "node:path";
import { sanitizePathSegment } from "../../snapshots/sanitize-path-segment.js";
import type { CollisionGroup, RunCapturePlan } from "./types.js";

/**
 * Stable disambiguator for a colliding run-capture (RFC-014.5 §8), derived
 * **only** from SnapRun business identity — never from plan position, array
 * index, scheduler order, completion order, or a random id.
 *
 * The run name is the primary identity for a run-capture. Because run names are
 * unique (schema invariant) and output collisions are always cross-run — two
 * runs capturing the *same* route id under a run-agnostic output structure —
 * the run name is both necessary and sufficient to give every capture in a
 * group a distinct directory. Two captures that share a run name are the same
 * route captured twice by the same run (identical business identity) and
 * therefore intentionally resolve to the *same* path: a harmless reorder or
 * filter of the plan can never rename an existing output.
 */
function stableDisambiguator(capture: RunCapturePlan): string {
  return sanitizePathSegment("run name", capture.runName);
}

/**
 * Insert the disambiguator directory before the `<routeId>` segment, preserving
 * the existing `.../<routeId>/page.png` nesting convention:
 *
 * ```text
 * run/<runId>/dashboard/page.png -> run/<runId>/<disambiguator>/dashboard/page.png
 * ```
 */
function relocate(originalOutputPath: string, disambiguator: string): string {
  const routeDirectory = dirname(originalOutputPath);
  const parentDirectory = dirname(routeDirectory);
  const routeSegment = basename(routeDirectory);
  const leaf = basename(originalOutputPath);

  return join(parentDirectory, disambiguator, routeSegment, leaf);
}

/**
 * Compute deterministic replacement paths for the "Create subfolders"
 * resolution (RFC-014.5 §8). Collision *detection* still uses the resolved
 * output path (`originalOutputPath`); resolution replaces it with a
 * `resolvedUniqueOutputPath` built from a stable business-identity
 * disambiguator. The result depends solely on each capture's own identity, so
 * it is invariant under plan reordering, insertion/removal of unrelated jobs,
 * concurrency, and completion order.
 *
 * @returns a map from `captureId` to its relocated output path.
 */
export function buildSubfolderPaths(
  groups: readonly CollisionGroup[],
): ReadonlyMap<string, string> {
  const relocated = new Map<string, string>();

  for (const group of groups) {
    for (const capture of group.captures) {
      relocated.set(capture.captureId, relocate(capture.filePath, stableDisambiguator(capture)));
    }
  }

  return relocated;
}
