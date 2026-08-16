import { LanternError } from "./lantern-error.js";

/** Thrown when `lantern lint --configure` cannot run its interactive workflow. */
export class LintConfigureError extends LanternError {
  readonly code = "LINT_CONFIGURE_FAILED";
}
