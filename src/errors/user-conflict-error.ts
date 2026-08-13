import { SnapRunError } from "./snaprun-error.js";

/** `run.user` and `route.user` are both defined and differ (RFC-008). */
export class UserConflictError extends SnapRunError {
  readonly code = "USER_CONFLICT";
  readonly runName: string;
  readonly routeId: string;
  readonly runUser: string;
  readonly routeUser: string;

  constructor(runName: string, routeId: string, runUser: string, routeUser: string) {
    super(
      `User conflict between run "${runName}" (${runUser}) and route "${routeId}" (${routeUser})`,
    );
    this.runName = runName;
    this.routeId = routeId;
    this.runUser = runUser;
    this.routeUser = routeUser;
  }
}
