import { ConfigInvalidError } from "../errors/config-invalid-error.js";
import type { RawRoute } from "../types/route.js";

/**
 * Replace only the `routes` key in a raw configuration object
 * (not yet validated or defaulted), keeping every other section exactly as
 * it was read from disk (RFC-006: changes are limited to `routes`).
 */
export function replaceRoutesInRawConfig(
  rawConfig: unknown,
  routes: readonly RawRoute[],
): Record<string, unknown> {
  if (typeof rawConfig !== "object" || rawConfig === null || Array.isArray(rawConfig)) {
    throw new ConfigInvalidError("Configuration must be a valid JSON object.");
  }

  return { ...(rawConfig as Record<string, unknown>), routes };
}
