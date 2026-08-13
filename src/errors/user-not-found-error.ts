import { SnapRunError } from "./snaprun-error.js";

export class UserNotFoundError extends SnapRunError {
  readonly code = "USER_NOT_FOUND";
  readonly userId: string;

  constructor(userId: string) {
    super(`User not found in authentication configuration: ${userId}`);
    this.userId = userId;
  }
}
