import { LanternError } from "./lantern-error.js";

/** `baseUrl` is unreachable: no running server, no usable auto-start, or startup timed out (RFC-011). */
export class ApplicationUnreachableError extends LanternError {
  readonly code = "APPLICATION_UNREACHABLE";

  constructor(baseUrl: string) {
    super(`Application is unreachable: ${baseUrl}`);
  }
}
