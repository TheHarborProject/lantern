import { describe, expect, it } from "vitest";
import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import type { RawStaticRoute } from "../types/route.js";
import { findRouteById } from "./find-route-by-id.js";

function staticRoute(id: string): RawStaticRoute {
  return { id, path: `/${id}`, enableSnapshot: true };
}

describe("findRouteById", () => {
  it("retourne la route correspondant à l'identifiant", () => {
    const routes = [staticRoute("a"), staticRoute("b")];

    expect(findRouteById(routes, "b")).toBe(routes[1]);
  });

  it("lève ROUTE_NOT_FOUND si aucun identifiant ne correspond", () => {
    const routes = [staticRoute("a")];

    try {
      findRouteById(routes, "absent");
      expect.fail("findRouteById aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(RouteNotFoundError);
      const notFoundError = error as RouteNotFoundError;
      expect(notFoundError.code).toBe("ROUTE_NOT_FOUND");
      expect(notFoundError.routeId).toBe("absent");
    }
  });
});
