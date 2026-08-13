import { SnapRunError } from "./snaprun-error.js";

/**
 * Raised when `snaprun init` would overwrite an existing configuration file
 * (RFC-013 §13). SnapRun never replaces a configuration file implicitly.
 */
export class ConfigAlreadyExistsError extends SnapRunError {
  readonly code = "CONFIG_ALREADY_EXISTS";
}
