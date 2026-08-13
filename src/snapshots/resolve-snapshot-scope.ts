import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import { findRouteById } from "../routes/find-route-by-id.js";
import { findRouteByPath } from "../routes/find-route-by-path.js";
import { findRunByName } from "../runs/find-run-by-name.js";
import type { RawRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import type { SnapshotSelection } from "../types/snapshot-selection.js";

export interface SnapshotScope {
  readonly routes: readonly RawRoute[];
  readonly runs: readonly RawRun[];
}

/**
 * Reduce `routes`/`runs` to the scope requested by
 * {@link SnapshotSelection} (RFC-010) before passing them to
 * `captureSnapshots` (RFC-009). For `run`, `routes` is limited to the routes
 * referenced by that run so no other route can be captured as standalone by
 * mistake (RFC-009 treats any enabled route not referenced by a run in the
 * provided subset as standalone).
 *
 * @throws {RunNotFoundError} `--runName` does not match any run.
 * @throws {RouteNotFoundError} `--route` does not match any route, or the
 *   route is not part of the selected run (`run-route`).
 */
export function resolveSnapshotScope(
  routes: readonly RawRoute[],
  runs: readonly RawRun[],
  selection: SnapshotSelection,
): SnapshotScope {
  switch (selection.kind) {
    case "all":
      return { routes, runs };

    case "run": {
      const run = findRunByName(runs, selection.runName);
      const referencedRoutes = run.routes.map((routeId) => findRouteById(routes, routeId));
      return { routes: referencedRoutes, runs: [run] };
    }

    case "route": {
      const route = findRouteByPath(routes, selection.routePath);
      // Explicit CLI selection takes precedence over enableSnapshot (RFC-010)
      // and over the configured user when `--user` is provided.
      return {
        routes: [{ ...route, enableSnapshot: true, user: selection.user ?? route.user }],
        runs: [],
      };
    }

    case "run-route": {
      const run = findRunByName(runs, selection.runName);
      const route = findRouteByPath(routes, selection.routePath);

      if (!run.routes.includes(route.id)) {
        throw new RouteNotFoundError(route.id);
      }

      return { routes: [route], runs: [{ ...run, routes: [route.id] }] };
    }
  }
}
