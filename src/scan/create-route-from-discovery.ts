import { extractPathParameterNames } from "../domain/routes/extract-path-parameter-names.js";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import type { RawRoute } from "../types/route.js";
import { generateRouteId } from "./generate-route-id.js";
import { PLACEHOLDER_PARAMETER_VALUE } from "./placeholder-parameter-value.js";

/**
 * Build the `Route` entry to add to configuration for a discovered route.
 * This is called only for routes without catch-all segments, filtered
 * upstream by `mergeDiscoveredRoutes`; see `hasCatchAllSegment`.
 *
 * `enableSnapshot` (the `--default` option) applies only to static routes.
 * A dynamic route always receives placeholder parameter values
 * ({@link PLACEHOLDER_PARAMETER_VALUE}) because its real value is never known
 * at scan time. It is therefore always created with `enableSnapshot: false`,
 * even with `--default=enabled`, to avoid automatically capturing a
 * deliberately incorrect URL (review follow-up, RFC-006).
 */
export function createRouteFromDiscovery(
  discovered: DiscoveredRoute,
  usedIds: ReadonlySet<string>,
  defaultEnableSnapshot: boolean,
): RawRoute {
  const id = generateRouteId(discovered.path, usedIds);

  if (!discovered.isDynamic) {
    return { id, path: discovered.path, enableSnapshot: defaultEnableSnapshot };
  }

  const parameterNames = extractPathParameterNames(discovered.path);
  const parameters = Object.fromEntries(
    parameterNames.map((name) => [name, PLACEHOLDER_PARAMETER_VALUE]),
  );

  return {
    id,
    path: discovered.path,
    isDynamic: true,
    parameters,
    enableSnapshot: false,
  };
}
