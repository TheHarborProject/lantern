import { describe, expect, it } from "vitest";
import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import { RunNotFoundError } from "../errors/run-not-found-error.js";
import type { RawStaticRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { resolveSnapshotScope } from "./resolve-snapshot-scope.js";

function staticRoute(
  id: string,
  path: string,
  overrides: Partial<RawStaticRoute> = {},
): RawStaticRoute {
  return { id, path, enableSnapshot: true, ...overrides };
}

function run(overrides: Partial<RawRun> = {}): RawRun {
  return { runName: "run", order: 1, routes: [], ...overrides };
}

describe("resolveSnapshotScope", () => {
  it("'all' renvoie routes et runs tels quels", () => {
    const routes = [staticRoute("a", "/a")];
    const runs = [run({ runName: "r1" })];

    expect(resolveSnapshotScope(routes, runs, { kind: "all" })).toEqual({ routes, runs });
  });

  it("'run' réduit 'routes' aux seules routes référencées par ce run", () => {
    const routes = [staticRoute("a", "/a"), staticRoute("b", "/b"), staticRoute("c", "/c")];
    const runs = [
      run({ runName: "member", routes: ["a", "b"] }),
      run({ runName: "admin", routes: ["c"] }),
    ];

    const scope = resolveSnapshotScope(routes, runs, { kind: "run", runName: "member" });

    expect(scope.runs).toEqual([runs[0]]);
    expect(scope.routes.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("'run' lève RUN_NOT_FOUND si --runName ne correspond à aucun run", () => {
    expect(() => resolveSnapshotScope([], [], { kind: "run", runName: "absent" })).toThrow(
      RunNotFoundError,
    );
  });

  it("'run' lève ROUTE_NOT_FOUND si le run référence une route absente de 'routes'", () => {
    const runs = [run({ runName: "member", routes: ["missing"] })];

    expect(() => resolveSnapshotScope([], runs, { kind: "run", runName: "member" })).toThrow(
      RouteNotFoundError,
    );
  });

  it("'route' force enableSnapshot: true même si la route est désactivée en configuration", () => {
    const routes = [staticRoute("a", "/a", { enableSnapshot: false })];

    const scope = resolveSnapshotScope(routes, [], {
      kind: "route",
      routePath: "/a",
      user: undefined,
    });

    expect(scope.runs).toEqual([]);
    expect(scope.routes).toHaveLength(1);
    expect(scope.routes[0]?.enableSnapshot).toBe(true);
    expect(scope.routes[0]?.user).toBeUndefined();
  });

  it("'route' avec --user l'emporte sur le user configuré sur la route", () => {
    const routes = [staticRoute("a", "/a", { user: "admin" })];

    const scope = resolveSnapshotScope(routes, [], {
      kind: "route",
      routePath: "/a",
      user: "member",
    });

    expect(scope.routes[0]?.user).toBe("member");
  });

  it("'route' sans --user conserve le user configuré sur la route", () => {
    const routes = [staticRoute("a", "/a", { user: "admin" })];

    const scope = resolveSnapshotScope(routes, [], {
      kind: "route",
      routePath: "/a",
      user: undefined,
    });

    expect(scope.routes[0]?.user).toBe("admin");
  });

  it("'route' lève ROUTE_NOT_FOUND si --route ne correspond à aucun chemin", () => {
    expect(() =>
      resolveSnapshotScope([], [], { kind: "route", routePath: "/absent", user: undefined }),
    ).toThrow(RouteNotFoundError);
  });

  it("'run-route' réduit le run à la seule route sélectionnée", () => {
    const routes = [staticRoute("a", "/a"), staticRoute("b", "/b")];
    const runs = [run({ runName: "member", routes: ["a", "b"] })];

    const scope = resolveSnapshotScope(routes, runs, {
      kind: "run-route",
      runName: "member",
      routePath: "/b",
    });

    expect(scope.routes).toEqual([routes[1]]);
    expect(scope.runs).toEqual([{ ...runs[0], routes: ["b"] }]);
  });

  it("'run-route' lève ROUTE_NOT_FOUND si la route n'est pas référencée par ce run", () => {
    const routes = [staticRoute("a", "/a"), staticRoute("b", "/b")];
    const runs = [run({ runName: "member", routes: ["a"] })];

    expect(() =>
      resolveSnapshotScope(routes, runs, {
        kind: "run-route",
        runName: "member",
        routePath: "/b",
      }),
    ).toThrow(RouteNotFoundError);
  });

  it("'run-route' lève RUN_NOT_FOUND si --runName ne correspond à aucun run", () => {
    const routes = [staticRoute("a", "/a")];

    expect(() =>
      resolveSnapshotScope(routes, [], { kind: "run-route", runName: "absent", routePath: "/a" }),
    ).toThrow(RunNotFoundError);
  });
});
