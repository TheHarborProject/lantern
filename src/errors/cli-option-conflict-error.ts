import { SnapRunError } from "./snaprun-error.js";

/** Combinaison d'options CLI incompatibles entre elles (RFC-010). */
export class CliOptionConflictError extends SnapRunError {
  readonly code = "CLI_OPTION_CONFLICT";

  constructor(message: string) {
    super(message);
  }
}
