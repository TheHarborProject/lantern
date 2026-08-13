import type { CollisionGroup } from "./types.js";

/**
 * Render a deterministic, human-readable description of output collisions
 * (RFC-014.5 §7), used for the `error` strategy message and the interactive
 * prompt. Groups are already ordered by path and captures by execution order,
 * so the output is stable across runs.
 *
 * ```text
 * 2 output collisions detected.
 *
 * run/2026/dashboard/page.png
 *   - member/dashboard
 *   - admin/dashboard
 * ```
 */
export function formatCollisions(groups: readonly CollisionGroup[]): string {
  const count = groups.length;
  const header = `${String(count)} output collision${count === 1 ? "" : "s"} detected.`;

  const blocks = groups.map((group) => {
    const lines = group.captures.map((capture) => `  - ${capture.runName}/${capture.routeId}`);
    return `${group.filePath}\n${lines.join("\n")}`;
  });

  return [header, ...blocks].join("\n\n");
}
