import { SnapRunError } from "./snaprun-error.js";

export class ConfigInvalidError extends SnapRunError {
  readonly code = "CONFIG_INVALID";
}
