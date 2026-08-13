import { SnapRunError } from "../errors/snaprun-error.js";

/**
 * Print an application error (RFC-010): the message only by default, or the
 * full stack trace and original cause with `--debug`.
 */
export function printCliError(error: SnapRunError, debug: boolean): void {
  console.error(error.message);

  if (debug) {
    console.error(error.stack);

    if (error.cause !== undefined) {
      console.error("Cause:", error.cause);
    }
  }
}
