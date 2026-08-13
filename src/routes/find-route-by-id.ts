import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import type { RawRoute } from "../types/route.js";

/** @throws {RouteNotFoundError} No route uses this identifier. */
export function findRouteById(routes: readonly RawRoute[], id: string): RawRoute {
  const route = routes.find((candidate) => candidate.id === id);

  if (route === undefined) {
    throw new RouteNotFoundError(id);
  }

  return route;
}
