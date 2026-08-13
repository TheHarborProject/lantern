import { describe, expect, it } from "vitest";
import { RouteNotFoundError } from "../errors/route-not-found-error.js";
import { UserConflictError } from "../errors/user-conflict-error.js";
import type { RawDynamicRoute, RawStaticRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { buildExecutionPlan } from "./build-execution-plan.js";

function staticRoute(id: string, overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
  return { id, path: `/${id}`, enableSnapshot: true, ...overrides };
}

function dynamicRoute(id: string, overrides: Partial<RawDynamicRoute> = {}): RawDynamicRoute {
  return {
    id,
    path: `/${id}/[itemId]`,
    isDynamic: true,
    parameters: { itemId: "seed-1" },
    enableSnapshot: true,
    ...overrides,
  };
}

function run(overrides: Partial<RawRun> = {}): RawRun {
  return { runName: "run", order: 1, routes: [], ...overrides };
}

describe("buildExecutionPlan", () => {
  it("trie les runs par 'order' croissant", () => {
    const routes = [staticRoute("a")];
    const runs = [run({ runName: "second", order: 2 }), run({ runName: "first", order: 1 })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan.map((plannedRun) => plannedRun.runName)).toEqual(["first", "second"]);
  });

  it("préserve l'ordre du tableau 'runs' en cas d'égalité d'order", () => {
    const routes = [staticRoute("a")];
    const runs = [
      run({ runName: "declared-first", order: 1 }),
      run({ runName: "declared-second", order: 1 }),
    ];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan.map((plannedRun) => plannedRun.runName)).toEqual([
      "declared-first",
      "declared-second",
    ]);
  });

  it("résout les routes dans l'ordre exact du tableau 'run.routes'", () => {
    const routes = [staticRoute("a"), staticRoute("b"), staticRoute("c")];
    const runs = [run({ routes: ["c", "a", "b"] })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan[0]?.routes.map((plannedRoute) => plannedRoute.route.id)).toEqual(["c", "a", "b"]);
  });

  it("lève ROUTE_NOT_FOUND si un run référence un identifiant de route inconnu", () => {
    const routes = [staticRoute("a")];
    const runs = [run({ routes: ["absent"] })];

    try {
      buildExecutionPlan(runs, routes);
      expect.fail("buildExecutionPlan aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(RouteNotFoundError);
      expect((error as RouteNotFoundError).routeId).toBe("absent");
    }
  });

  it("lève USER_CONFLICT si le user du run et celui de la route diffèrent tous deux définis", () => {
    const routes = [staticRoute("a", { user: "admin" })];
    const runs = [run({ user: "member", routes: ["a"] })];

    try {
      buildExecutionPlan(runs, routes);
      expect.fail("buildExecutionPlan aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(UserConflictError);
      const conflict = error as UserConflictError;
      expect(conflict.code).toBe("USER_CONFLICT");
      expect(conflict.runName).toBe("run");
      expect(conflict.routeId).toBe("a");
      expect(conflict.runUser).toBe("member");
      expect(conflict.routeUser).toBe("admin");
    }
  });

  it("n'est pas un conflit quand le user du run et celui de la route sont identiques", () => {
    const routes = [staticRoute("a", { user: "member" })];
    const runs = [run({ user: "member", routes: ["a"] })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan[0]?.routes[0]?.user).toBe("member");
  });

  it("produit un run public quand ni le run ni la route ne définissent de user", () => {
    const routes = [staticRoute("a")];
    const runs = [run({ routes: ["a"] })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan[0]?.routes[0]?.user).toBeUndefined();
  });

  it("utilise le user de la route quand le run n'en définit pas", () => {
    const routes = [staticRoute("a", { user: "admin" })];
    const runs = [run({ routes: ["a"] })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan[0]?.routes[0]?.user).toBe("admin");
  });

  it("utilise le user du run quand la route n'en définit pas", () => {
    const routes = [staticRoute("a")];
    const runs = [run({ user: "member", routes: ["a"] })];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan[0]?.routes[0]?.user).toBe("member");
  });

  it("construit un plan complet : plusieurs runs, plusieurs routes, tri et résolution combinés", () => {
    const routes = [
      staticRoute("home"),
      staticRoute("member-calendar", { user: "member" }),
      staticRoute("admin-dashboard", { user: "admin" }),
    ];
    const runs = [
      run({ runName: "admin", user: "admin", order: 2, routes: ["admin-dashboard"] }),
      run({ runName: "public", order: 0, routes: ["home"] }),
      run({ runName: "member", user: "member", order: 1, routes: ["member-calendar", "home"] }),
    ];

    const plan = buildExecutionPlan(runs, routes);

    expect(plan).toHaveLength(3);
    expect(plan.map((plannedRun) => plannedRun.runName)).toEqual(["public", "member", "admin"]);

    expect(plan[0]).toEqual({
      runName: "public",
      order: 0,
      routes: [{ route: routes[0], user: undefined }],
    });
    expect(plan[1]).toEqual({
      runName: "member",
      order: 1,
      routes: [
        { route: routes[1], user: "member" },
        { route: routes[0], user: "member" },
      ],
    });
    expect(plan[2]).toEqual({
      runName: "admin",
      order: 2,
      routes: [{ route: routes[2], user: "admin" }],
    });
  });

  describe("immutabilité du plan", () => {
    it("n'est pas affecté par un push ultérieur dans 'config.runs[0].routes'", () => {
      const routes = [staticRoute("a"), staticRoute("b")];
      const config = { runs: [run({ routes: ["a"] })], routes };

      const plan = buildExecutionPlan(config.runs, config.routes);

      config.runs[0]?.routes.push("b");

      expect(plan[0]?.routes).toHaveLength(1);
      expect(plan[0]?.routes.map((plannedRoute) => plannedRoute.route.id)).toEqual(["a"]);
    });

    it("n'est pas affecté par un push ultérieur dans 'config.routes'", () => {
      const config = { runs: [run({ routes: ["a"] })], routes: [staticRoute("a")] };

      const plan = buildExecutionPlan(config.runs, config.routes);

      config.routes.push(staticRoute("b"));

      expect(plan[0]?.routes).toHaveLength(1);
      expect(plan[0]?.routes.map((plannedRoute) => plannedRoute.route.id)).toEqual(["a"]);
    });

    it("n'est pas affecté par une mutation ultérieure d'un champ d'une route de 'config.routes'", () => {
      const routeA = staticRoute("a");
      const config = { runs: [run({ routes: ["a"] })], routes: [routeA] };

      const plan = buildExecutionPlan(config.runs, config.routes);

      routeA.enableSnapshot = false;
      routeA.path = "/mutated";

      expect(plan[0]?.routes[0]?.route.enableSnapshot).toBe(true);
      expect(plan[0]?.routes[0]?.route.path).toBe("/a");
    });

    it("n'est pas affecté par une mutation ultérieure de 'parameters' d'une route dynamique", () => {
      const routeA = dynamicRoute("a");
      const config = { runs: [run({ routes: ["a"] })], routes: [routeA] };

      const plan = buildExecutionPlan(config.runs, config.routes);

      routeA.parameters["itemId"] = "mutated";
      routeA.parameters["extra"] = "injected";

      const plannedRoute = plan[0]?.routes[0]?.route;
      expect(
        plannedRoute && "parameters" in plannedRoute ? plannedRoute.parameters : undefined,
      ).toEqual({
        itemId: "seed-1",
      });
    });

    it("expose des routes indépendantes de 'config.routes' (pas de simples références)", () => {
      const routeA = staticRoute("a");
      const config = { runs: [run({ routes: ["a"] })], routes: [routeA] };

      const plan = buildExecutionPlan(config.runs, config.routes);

      expect(plan[0]?.routes[0]?.route).toEqual(routeA);
      expect(plan[0]?.routes[0]?.route).not.toBe(routeA);
    });
  });
});
