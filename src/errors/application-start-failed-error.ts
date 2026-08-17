import { LanternError } from "./lantern-error.js";

/** `startScript` is missing, or the process launched by Lantern exits before becoming reachable. */
export class ApplicationStartFailedError extends LanternError {
  readonly code = "APPLICATION_START_FAILED";

  constructor(startScript: string, options?: { readonly cause?: unknown }) {
    super(`Failed to start the application with package script: ${startScript}`, options);
  }
}
