import { SnapRunError } from "./snaprun-error.js";

export class DynamicParameterUnknownError extends SnapRunError {
  readonly code = "DYNAMIC_PARAMETER_UNKNOWN";
  readonly routeId: string;
  readonly parameterName: string;

  constructor(routeId: string, parameterName: string) {
    super(`Unknown dynamic route parameter for '${routeId}': ${parameterName}`);
    this.routeId = routeId;
    this.parameterName = parameterName;
  }
}
