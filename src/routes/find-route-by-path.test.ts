import { describe, expect, it } from "vitest";
import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import type { RawStaticRoute } from "../types/route.js";
import { findRouteByPath } from "./find-route-by-path.js";

function staticRoute(id: string, path: string): RawStaticRoute {
  return { id, path, enableSnapshot: true };
}

describe("findRouteByPath", () => {
  it("retourne la route correspondant au chemin", () => {
    const routes = [staticRoute("a", "/a"), staticRoute("b", "/b")];

    expect(findRouteByPath(routes, "/b")).toBe(routes[1]);
  });

  it("lève ROUTE_NOT_FOUND si aucun chemin ne correspond", () => {
    const routes = [staticRoute("a", "/a")];

    try {
      findRouteByPath(routes, "/absent");
      expect.fail("findRouteByPath aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(RouteNotFoundError);
      expect((error as RouteNotFoundError).routeId).toBe("/absent");
    }
  });
});
