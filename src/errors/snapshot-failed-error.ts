import { SnapRunError } from "./snaprun-error.js";

/** Route capture failure (RFC-009): navigation, pre-authentication, or PNG write failure. */
export class SnapshotFailedError extends SnapRunError {
  readonly code = "SNAPSHOT_FAILED";
  readonly routeId: string;

  constructor(routeId: string, options?: { readonly cause?: unknown }) {
    super(`Snapshot failed for route: ${routeId}`, options);
    this.routeId = routeId;
  }
}
