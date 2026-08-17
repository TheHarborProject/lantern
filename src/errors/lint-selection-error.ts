import { LanternError } from "./lantern-error.js";

/** Thrown when an audit request selects canonical component/state/check IDs the current target set cannot satisfy. */
export class LintSelectionError extends LanternError {
  readonly code = "LINT_SELECTION_INVALID";
}
