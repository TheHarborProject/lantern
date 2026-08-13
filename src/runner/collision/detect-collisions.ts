import type { CollisionGroup, RunCapturePlan } from "./types.js";

/**
 * Group run-captures that resolve to the same output path (RFC-014.5 §4). A
 * collision group is any output path targeted by two or more captures. The
 * result is deterministic: groups are ordered by `filePath`, and the captures
 * inside each group are ordered by their global {@link RunCapturePlan.order}.
 *
 * Detection is based solely on the resolved output path, never on route id,
 * run, scope, or user, so any future output structure benefits automatically.
 */
export function detectCollisions(
  captures: readonly RunCapturePlan[],
): readonly CollisionGroup[] {
  const capturesByPath = new Map<string, RunCapturePlan[]>();

  for (const capture of captures) {
    const existing = capturesByPath.get(capture.filePath);
    if (existing === undefined) {
      capturesByPath.set(capture.filePath, [capture]);
    } else {
      existing.push(capture);
    }
  }

  const groups: CollisionGroup[] = [];

  for (const [filePath, group] of capturesByPath) {
    if (group.length >= 2) {
      groups.push({
        filePath,
        captures: [...group].sort((a, b) => a.order - b.order),
      });
    }
  }

  groups.sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0));

  return groups;
}
