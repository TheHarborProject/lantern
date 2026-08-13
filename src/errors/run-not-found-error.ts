import { SnapRunError } from "./snaprun-error.js";

export class RunNotFoundError extends SnapRunError {
  readonly code = "RUN_NOT_FOUND";
  readonly runName: string;

  constructor(runName: string) {
    super(`Run not found: ${runName}`);
    this.runName = runName;
  }
}
