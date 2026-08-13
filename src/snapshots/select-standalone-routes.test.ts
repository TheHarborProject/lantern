import { describe, expect, it } from "vitest";
import type { RawStaticRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { selectStandaloneRoutes } from "./select-standalone-routes.js";

function staticRoute(id: string, overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
  return { id, path: `/${id}`, enableSnapshot: true, ...overrides };
}

function run(overrides: Partial<RawRun> = {}): RawRun {
  return { runName: "run", order: 1, routes: [], ...overrides };
}

describe("selectStandaloneRoutes", () => {
  it("retient les routes activées et non référencées par un run", () => {
    const routes = [staticRoute("a"), staticRoute("b")];
    const runs = [run({ routes: ["a"] })];

    expect(selectStandaloneRoutes(routes, runs).map((route) => route.id)).toEqual(["b"]);
  });

  it("exclut les routes désactivées (enableSnapshot: false)", () => {
    const routes = [staticRoute("a", { enableSnapshot: false })];

    expect(selectStandaloneRoutes(routes, [])).toEqual([]);
  });

  it("exclut une route référencée par un run même si un autre run existe", () => {
    const routes = [staticRoute("a"), staticRoute("b")];
    const runs = [run({ runName: "first", routes: ["a"] }), run({ runName: "second", routes: [] })];

    expect(selectStandaloneRoutes(routes, runs).map((route) => route.id)).toEqual(["b"]);
  });

  it("préserve l'ordre de 'routes'", () => {
    const routes = [staticRoute("c"), staticRoute("a"), staticRoute("b")];

    expect(selectStandaloneRoutes(routes, []).map((route) => route.id)).toEqual(["c", "a", "b"]);
  });

  it("renvoie une liste vide quand toutes les routes sont référencées par un run", () => {
    const routes = [staticRoute("a")];
    const runs = [run({ routes: ["a"] })];

    expect(selectStandaloneRoutes(routes, runs)).toEqual([]);
  });
});
