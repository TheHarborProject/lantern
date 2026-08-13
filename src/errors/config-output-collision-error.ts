import { SnapRunError } from "./snaprun-error.js";

/**
 * Raised when two snapshot jobs resolve to the same output path and the active
 * collision strategy forbids proceeding (RFC-014.5 §7 `error`, or `prompt`
 * falling back to `error` in a non-interactive environment, §10). This is a
 * planning error, not a capture failure: it aborts before any conflicting
 * screenshot is produced.
 */
export class ConfigOutputCollisionError extends SnapRunError {
  readonly code = "OUTPUT_COLLISION";
}
