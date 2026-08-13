import { UserConflictError } from "../errors/user-conflict-error.js";
import { findRouteById } from "../routes/find-route-by-id.js";
import type { ExecutionPlan, PlannedRoute, PlannedRouteSnapshot } from "../types/execution-plan.js";
import type { RawRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";

/**
 * Build the typed execution plan (RFC-008) before any browser is opened:
 * runs sorted by `order` (ties keep the `runs` array order because
 * `Array.prototype.sort` is stable), routes resolved in exact `run.routes`
 * order, and effective user computed from run/route values.
 *
 * @throws {RouteNotFoundError} A `run.routes` entry references an id missing from `routes`.
 * @throws {UserConflictError} `run.user` and `route.user` are both defined and differ.
 */
export function buildExecutionPlan(
  runs: readonly RawRun[],
  routes: readonly RawRoute[],
): ExecutionPlan {
  return [...runs]
    .sort((a, b) => a.order - b.order)
    .map((run) => ({
      runName: run.runName,
      order: run.order,
      routes: run.routes.map((routeId) => resolvePlannedRoute(run, routeId, routes)),
    }));
}

function resolvePlannedRoute(
  run: RawRun,
  routeId: string,
  routes: readonly RawRoute[],
): PlannedRoute {
  const route = findRouteById(routes, routeId);

  if (run.user !== undefined && route.user !== undefined && run.user !== route.user) {
    throw new UserConflictError(run.runName, route.id, run.user, route.user);
  }

  return { route: snapshotRoute(route), user: route.user ?? run.user };
}

/**
 * Independent copy of `route`: neither the route itself nor its
 * `parameters` (for dynamic routes) are shared with `config.routes`, so a
 * later mutation of the loaded configuration never leaks into a plan that
 * was already built.
 */
function snapshotRoute(route: RawRoute): PlannedRouteSnapshot {
  if (route.isDynamic === true) {
    return { ...route, parameters: { ...route.parameters } };
  }

  return { ...route };
}
