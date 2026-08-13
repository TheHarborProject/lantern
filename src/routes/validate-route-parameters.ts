import { DynamicParameterMissingError } from "../errors/dynamic-parameter-missing-error.js";
import { DynamicParameterUnknownError } from "../errors/dynamic-parameter-unknown-error.js";
import type { RawDynamicRoute } from "../types/route.js";
import { computeParameterDiscrepancies } from "../domain/routes/compute-parameter-discrepancies.js";

/**
 * Validate structural consistency between `path` and `parameters` for a
 * dynamic route. Always called (RFC-004, review follow-up), regardless of
 * whether `snapshotPath` is present: it only overrides the final visited URL
 * and never replaces this validation step.
 *
 * @throws {DynamicParameterMissingError} A `[param]` segment has no value in `parameters`.
 * @throws {DynamicParameterUnknownError} A `parameters` key is not referenced by `path`.
 */
export function validateRouteParameters(route: RawDynamicRoute): void {
  const { missing, unknown } = computeParameterDiscrepancies(route.path, route.parameters);

  const firstMissing = missing[0];
  if (firstMissing !== undefined) {
    throw new DynamicParameterMissingError(route.id, firstMissing);
  }

  const firstUnknown = unknown[0];
  if (firstUnknown !== undefined) {
    throw new DynamicParameterUnknownError(route.id, firstUnknown);
  }
}
