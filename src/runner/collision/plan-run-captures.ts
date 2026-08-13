import type { ExecutionPlan } from "../../types/execution-plan.js";
import { computeSnapshotFilePath } from "../../snapshots/compute-snapshot-file-path.js";
import type { RunCapturePlan } from "./types.js";

export interface PlanRunCapturesOptions {
  readonly outputDirectory: string;
  readonly structure: "flat" | "run" | "scope";
  readonly runId: string | undefined;
}

/**
 * Flatten the execution plan into the deterministic, ordered list of
 * run-captures (RFC-014.5 section 5), each with its fully resolved output
 * path. This mirrors the capture enumeration performed during execution
 * exactly (only `enableSnapshot` routes count, and the 1-based `index` follows
 * the run's capture order), so a capture's `captureId` and `filePath` computed
 * here are identical to the ones used when the capture actually runs.
 *
 * The resulting `filePath` is the sole collision key: two captures conflict
 * when their paths are equal, regardless of run, route, scope, or user.
 */
export function planRunCaptures(
  plan: ExecutionPlan,
  options: PlanRunCapturesOptions,
): readonly RunCapturePlan[] {
  const captures: RunCapturePlan[] = [];
  let order = 0;

  for (const plannedRun of plan) {
    let index = 0;

    for (const plannedRoute of plannedRun.routes) {
      if (!plannedRoute.route.enableSnapshot) {
        continue;
      }

      index += 1;
      order += 1;

      const filePath = computeSnapshotFilePath(options.outputDirectory, {
        structure: options.structure,
        kind: "run",
        runName: plannedRun.runName,
        index,
        routeId: plannedRoute.route.id,
        scope: plannedRoute.route.scope,
        runId: options.runId,
      });

      // JSON encoding gives an unambiguous, text-safe key: run names or route
      // ids that contain the separator can never be confused for one another.
      const captureId = JSON.stringify([plannedRun.runName, plannedRoute.route.id, index]);

      captures.push({
        captureId,
        filePath,
        runName: plannedRun.runName,
        routeId: plannedRoute.route.id,
        index,
        order,
        plannedRoute,
      });
    }
  }

  return captures;
}
