import { LanternError } from "./lantern-error.js";

export class ConfigInvalidError extends LanternError {
  readonly code = "CONFIG_INVALID";
}
