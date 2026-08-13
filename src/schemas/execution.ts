import { z } from "zod";

/**
 * `execution` section (RFC-014). Controls bounded parallel snapshot
 * execution. Optional as a whole, with a runtime default applied when the
 * section or its fields are omitted, so the resolved configuration always
 * carries a usable `concurrency` value:
 * - `concurrency` is the maximum number of snapshot jobs (runs and standalone
 *   routes) allowed to execute simultaneously. It must be an integer `>= 1`
 *   and defaults to `4`. A value of `1` reproduces the historical sequential
 *   behavior.
 * - `collisionStrategy` (RFC-014.5) selects how SnapRun resolves two captures
 *   that target the same output path under parallel execution: `prompt`
 *   (default; interactive, falls back to `error` in non-interactive
 *   environments), `serialize` (conflicting captures run sequentially, others
 *   stay parallel), or `error` (abort before any conflicting screenshot).
 */
export const executionSchema = z
  .object({
    concurrency: z.number().int().min(1).default(4),
    collisionStrategy: z.enum(["prompt", "serialize", "error"]).default("prompt"),
  })
  .default({});

/** Validated `execution` section, inferred from {@link executionSchema}. */
export type ExecutionConfig = z.infer<typeof executionSchema>;
