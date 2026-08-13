import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import type { RawRoute } from "../types/route.js";

/** @throws {RouteNotFoundError} No route uses this path (`path`). */
export function findRouteByPath(routes: readonly RawRoute[], path: string): RawRoute {
  const route = routes.find((candidate) => candidate.path === path);

  if (route === undefined) {
    throw new RouteNotFoundError(path);
  }

  return route;
}
