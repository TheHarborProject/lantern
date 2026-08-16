import { LanternError } from "./lantern-error.js";

/** Thrown when `--since <git-ref>` cannot be resolved: no Git repository, or an unknown ref. */
export class LintTargetingError extends LanternError {
  readonly code = "LINT_TARGETING_INVALID";
}
