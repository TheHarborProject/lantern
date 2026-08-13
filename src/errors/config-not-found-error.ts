import { LanternError } from "./lantern-error.js";

export class ConfigNotFoundError extends LanternError {
  readonly code = "CONFIG_NOT_FOUND";
}
