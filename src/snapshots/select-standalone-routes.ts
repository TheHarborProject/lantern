import type { RawRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";

/**
 * Routes captured outside any run (RFC-009): `enableSnapshot: true` and never
 * referenced by any `run.routes`. Preserve `routes` order because no run
 * ordering applies to these independent captures.
 */
export function selectStandaloneRoutes(
  routes: readonly RawRoute[],
  runs: readonly RawRun[],
): readonly RawRoute[] {
  const referencedRouteIds = new Set(runs.flatMap((run) => run.routes));

  return routes.filter((route) => route.enableSnapshot && !referencedRouteIds.has(route.id));
}
