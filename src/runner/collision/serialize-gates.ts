import type { CollisionGroup } from "./types.js";

/**
 * Sequencing gate for a single colliding capture: `before` (when defined) must
 * be awaited before writing, and `done` must be called once the capture has
 * settled (success or failure). `done` is idempotent, so callers may release
 * it defensively (for example in a `finally`, or when a job is skipped) without
 * risking a deadlock.
 */
export interface SerializeGate {
  readonly before: Promise<void> | undefined;
  readonly done: () => void;
}

/**
 * Build per-capture sequencing gates for the `serialize` strategy
 * (RFC-014.5 §9). Within each collision group, captures are chained in their
 * deterministic order: capture N waits for capture N-1 to finish before
 * writing. This guarantees "at most one active job owns a given output
 * resource" and a deterministic overwrite order (the highest-order capture
 * wins on disk), while captures on unrelated paths get no gate and stay fully
 * parallel.
 *
 * Each gate's `done` resolves an independent promise, so calling it more than
 * once is harmless — this keeps the chain deadlock-free even when a capture is
 * skipped or its job is aborted before reaching it.
 */
export function buildSerializeGates(
  groups: readonly CollisionGroup[],
): ReadonlyMap<string, SerializeGate> {
  const gates = new Map<string, SerializeGate>();

  for (const group of groups) {
    let previous: Promise<void> | undefined;

    for (const capture of group.captures) {
      let release!: () => void;
      const completed = new Promise<void>((resolve) => {
        release = resolve;
      });

      gates.set(capture.captureId, { before: previous, done: release });
      previous = completed;
    }
  }

  return gates;
}
