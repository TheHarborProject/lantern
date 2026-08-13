import type { PlannedRoute } from "../../types/execution-plan.js";

/**
 * Output collision strategy (RFC-014.5 §6). Selects how SnapRun resolves two
 * jobs that resolve to the same output path under parallel execution:
 * - `error`: abort before any conflicting screenshot is produced (CI-safe);
 * - `serialize`: run conflicting captures sequentially, others stay parallel;
 * - `prompt`: ask interactively (falls back to `error` when non-interactive).
 */
export type CollisionStrategy = "prompt" | "serialize" | "error";

/**
 * Interactive resolution chosen at the prompt (RFC-014.5 §8):
 * - `rerun-sequentially` / `overwrite-sequentially`: capture conflicting
 *   outputs one at a time at the same path (the last in deterministic order
 *   wins on disk);
 * - `create-subfolders`: capture each at a deterministic unique path;
 * - `skip`: skip the conflicting captures (reported explicitly).
 */
export type CollisionResolution =
  | "rerun-sequentially"
  | "overwrite-sequentially"
  | "create-subfolders"
  | "skip";

/**
 * A single planned run-capture: the atomic unit for collision *detection*
 * (RFC-014.5 §4), i.e. a "collision resource", not an execution job. The
 * execution job boundary is unchanged from RFC-014 (a whole run); a
 * `RunCapturePlan` is only used to reason about individual output paths within
 * that run, never to schedule routes independently.
 *
 * Standalone captures never collide (unique route ids), so only run-captures
 * are modeled here. `filePath` is the fully resolved output path and is the
 * sole collision key. `order` is the deterministic global position across the
 * whole execution plan; `captureId` uniquely identifies the capture within the
 * plan.
 */
export interface RunCapturePlan {
  readonly captureId: string;
  readonly filePath: string;
  readonly runName: string;
  readonly routeId: string;
  /** 1-based position within its run's enabled routes (capture order). */
  readonly index: number;
  /** Deterministic global order across all run-captures. */
  readonly order: number;
  readonly plannedRoute: PlannedRoute;
}

/**
 * A set of run-captures that resolve to the same output path (RFC-014.5 §4).
 * `captures` always contains at least two entries, ordered by {@link
 * RunCapturePlan.order}. Groups are reported ordered by `filePath`.
 */
export interface CollisionGroup {
  readonly filePath: string;
  readonly captures: readonly RunCapturePlan[];
}

/**
 * Interactive collision prompt (RFC-014.5 §7). Given the deterministic
 * collision queue, resolves to the chosen {@link CollisionResolution}. Never
 * invoked in non-interactive environments (RFC-014.5 §10).
 */
export type CollisionPrompt = (groups: readonly CollisionGroup[]) => Promise<CollisionResolution>;
