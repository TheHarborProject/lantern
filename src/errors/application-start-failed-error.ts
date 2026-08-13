import { LanternError } from "./lantern-error.js";

/** `startCommand` is missing, or the process launched by Lantern exits before becoming reachable. */
export class ApplicationStartFailedError extends LanternError {
  readonly code = "APPLICATION_START_FAILED";

  constructor(startCommand: string, options?: { readonly cause?: unknown }) {
    super(`Failed to start the application with command: ${startCommand}`, options);
  }
}
