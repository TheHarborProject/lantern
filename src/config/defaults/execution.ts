import type { ExecutionConfig } from "../../schemas/execution.js";

/**
 * Starter `execution` section written by `snaprun init` (RFC-014 §4). Exposes
 * the concurrency limit with its representative default so the generated
 * configuration stays exhaustive.
 */
export const defaultExecutionConfig: ExecutionConfig = {
  concurrency: 4,
  collisionStrategy: "prompt",
};
