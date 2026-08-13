import { SnapRunError } from "./snaprun-error.js";

/** The message includes only the variable name: never a value, never a secret. */
export class EnvVariableMissingError extends SnapRunError {
  readonly code = "ENV_VARIABLE_MISSING";
  readonly variableName: string;

  constructor(variableName: string) {
    super(`Missing environment variable: ${variableName}`);
    this.variableName = variableName;
  }
}
