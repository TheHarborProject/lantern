import type { SnaprunConfig } from "../../schemas/config.js";
import { defaultAuthConfig } from "./auth.js";
import { defaultExecutionConfig } from "./execution.js";
import { defaultOutputConfig } from "./output.js";
import { defaultProjectConfig } from "./project.js";

/**
 * Build the exhaustive starter configuration written by `snaprun init`
 * (RFC-013 §10, extended by RFC-014). It exposes every configuration domain
 * SnapRun supports — `project`, `output`, `auth`, `routes`, `runs`,
 * `execution` — so users can discover and delete options rather than guess at
 * missing ones.
 *
 * `routes` and `runs` are intentionally empty (RFC-013 §11): the generated
 * file never invents application structure; route discovery stays the job of
 * `snaprun scan`.
 *
 * The returned object is a valid {@link SnaprunConfig} and is verified against
 * `configSchema` by the init tests (RFC-013 §14).
 */
export function createDefaultConfig(): SnaprunConfig {
  return {
    project: { ...defaultProjectConfig },
    output: { ...defaultOutputConfig },
    auth: {
      ...defaultAuthConfig,
      selectors: { ...defaultAuthConfig.selectors },
      users: { ...defaultAuthConfig.users },
    },
    routes: [],
    runs: [],
    execution: { ...defaultExecutionConfig },
  };
}
