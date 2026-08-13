import { SnapRunError } from "./snaprun-error.js";

/** `startCommand` is missing, or the process launched by SnapRun exits before becoming reachable (RFC-011). */
export class ApplicationStartFailedError extends SnapRunError {
  readonly code = "APPLICATION_START_FAILED";

  constructor(startCommand: string, options?: { readonly cause?: unknown }) {
    super(`Failed to start the application with command: ${startCommand}`, options);
  }
}
