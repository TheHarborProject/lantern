/** A successful PNG capture (RFC-009). */
export interface CapturedSnapshot {
  readonly routeId: string;
  readonly filePath: string;
  readonly durationMs: number;
}

/** Successful captures for a run, in the exact `run.routes` order. */
export interface RunSnapshotResult {
  readonly runName: string;
  readonly snapshots: readonly CapturedSnapshot[];
}

/**
 * Details about the failure that interrupted capture (fail-fast, RFC-009).
 * `runName` is `undefined` for a route captured outside a run (standalone).
 */
export interface SnapshotFailure {
  readonly routeId: string;
  readonly runName: string | undefined;
  readonly message: string;
}

/**
 * A capture skipped because of an output collision (RFC-014.5 §8 "Skip"). This
 * is deliberately distinct from a {@link SnapshotFailure}: a collision is a
 * planning decision, not a capture error.
 */
export interface SkippedCapture {
  readonly routeId: string;
  readonly runName: string | undefined;
  readonly filePath: string;
  readonly reason: "collision";
}

/**
 * A detected output collision reported alongside the execution (RFC-014.5
 * §11): several captures resolved to the same output path. Deterministic:
 * `captures` are listed in execution order.
 */
export interface OutputCollision {
  readonly filePath: string;
  readonly captures: readonly { readonly routeId: string; readonly runName: string | undefined }[];
}

/**
 * Final report for a capture execution (RFC-009). Always returned on both
 * success and failure: when `succeeded` is `false`, `runs` and `standalone`
 * contain only the captures that completed before fail-fast stopped the run,
 * and `failure` describes the route that caused the failure.
 *
 * `collisions` and `skipped` (RFC-014.5) are present only when output
 * collisions were detected/resolved, and are kept separate from `failure`.
 */
export interface SnapshotReport {
  readonly succeeded: boolean;
  readonly durationMs: number;
  readonly runs: readonly RunSnapshotResult[];
  readonly standalone: readonly CapturedSnapshot[];
  readonly failure: SnapshotFailure | undefined;
  readonly collisions?: readonly OutputCollision[];
  readonly skipped?: readonly SkippedCapture[];
}
