import { LanternError } from "./lantern-error.js";

/**
 * Raised when configuration creation would overwrite an existing file.
 */
export class ConfigAlreadyExistsError extends LanternError {
  readonly code = "CONFIG_ALREADY_EXISTS";
}
