import { LanternError } from "./lantern-error.js";

/** Raised when Lantern cannot safely inspect or initialize a project. */
export class InitError extends LanternError {
  readonly code = "INIT_FAILED";
}
