import { SnapRunError } from "./snaprun-error.js";

/** The message never includes the email or password used, only the user id. */
export class AuthenticationFailedError extends SnapRunError {
  readonly code = "AUTHENTICATION_FAILED";
  readonly userId: string;

  constructor(userId: string) {
    super(`Authentication failed for user: ${userId}`);
    this.userId = userId;
  }
}
