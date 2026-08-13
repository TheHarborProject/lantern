import { SnapRunError } from "./snaprun-error.js";

export class ConfigNotFoundError extends SnapRunError {
  readonly code = "CONFIG_NOT_FOUND";
}
