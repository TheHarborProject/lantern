import { DynamicParameterMissingError } from "../errors/dynamic-parameter-missing-error.js";
import type { RawDynamicRoute, RawRoute } from "../types/route.js";
import { validateRouteParameters } from "./validate-route-parameters.js";

const PARAMETER_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;

/**
 * Resolve the final path for a route.
 *
 * The structural consistency between `path` and `parameters` for a dynamic
 * route is always validated (RFC-004, review follow-up), even when
 * `snapshotPath` is provided: it only overrides the final visited URL and
 * never bypasses model validation.
 *
 * Resolution priority: use `snapshotPath` when provided, otherwise replace
 * `[param]` segments from `path` with `parameters` values (URL-encoded).
 *
 * @throws {DynamicParameterMissingError} A `[param]` segment has no value in `parameters`.
 * @throws {DynamicParameterUnknownError} A `parameters` key is not referenced by `path`.
 */
export function resolveRoutePath(route: RawRoute): string {
  if (!route.isDynamic) {
    return route.snapshotPath ?? route.path;
  }

  // Called even when `snapshotPath` is provided: see the note above.
  validateRouteParameters(route);

  return route.snapshotPath ?? substituteDynamicPath(route);
}

/**
 * Assume the route has already been validated by
 * {@link validateRouteParameters} (called just before in
 * {@link resolveRoutePath}). The presence check below remains a
 * defense-in-depth safeguard if this function is ever called directly on
 * unvalidated data.
 */
function substituteDynamicPath(route: RawDynamicRoute): string {
  return route.path.replace(PARAMETER_PATTERN, (_match, parameterName: string) => {
    const value = route.parameters[parameterName];
    if (value === undefined) {
      throw new DynamicParameterMissingError(route.id, parameterName);
    }

    return encodeURIComponent(value);
  });
}
