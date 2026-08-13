import { SnapRunError } from "./snaprun-error.js";

/** `project.baseUrl` is required for capture but missing from the configuration (RFC-010). */
export class BaseUrlMissingError extends SnapRunError {
  readonly code = "BASE_URL_MISSING";

  constructor() {
    super(
      "project.baseUrl is required to capture snapshots. Add it to the SnapRun configuration.",
    );
  }
}
