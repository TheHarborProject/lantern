import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "../../runs/build-execution-plan.js";
import type { RawRoute } from "../../types/route.js";
import type { RawRun } from "../../types/run.js";
import { detectCollisions } from "./detect-collisions.js";
import { planRunCaptures } from "./plan-run-captures.js";

function route(id: string, path: string, extra: Partial<RawRoute> = {}): RawRoute {
  return { id, path, enableSnapshot: true, ...extra } as RawRoute;
}

describe("planRunCaptures", () => {
  it("n'inclut que les routes activées, avec index 1-based et ordre global croissant", () => {
    const routes = [route("home", "/home"), route("off", "/off", { enableSnapshot: false }), route("cal", "/cal")];
    const runs: RawRun[] = [{ runName: "member", order: 1, routes: ["home", "off", "cal"] }];

    const captures = planRunCaptures(buildExecutionPlan(runs, routes), {
      outputDirectory: "/out",
      structure: "flat",
      runId: undefined,
    });

    expect(captures.map((c) => c.routeId)).toEqual(["home", "cal"]);
    expect(captures.map((c) => c.index)).toEqual([1, 2]);
    expect(captures.map((c) => c.order)).toEqual([1, 2]);
  });

  it("produit des chemins distincts en structure flat (aucune collision)", () => {
    const routes = [route("dashboard", "/dashboard")];
    const runs: RawRun[] = [
      { runName: "member", order: 1, routes: ["dashboard"] },
      { runName: "admin", order: 2, routes: ["dashboard"] },
    ];

    const captures = planRunCaptures(buildExecutionPlan(runs, routes), {
      outputDirectory: "/out",
      structure: "flat",
      runId: undefined,
    });

    expect(captures.map((c) => c.filePath)).toEqual([
      join("/out", "member", "01-dashboard.png"),
      join("/out", "admin", "01-dashboard.png"),
    ]);
    expect(detectCollisions(captures)).toEqual([]);
  });

  it("fait collisionner la même route capturée dans deux runs en structure 'run'", () => {
    const routes = [route("dashboard", "/dashboard")];
    const runs: RawRun[] = [
      { runName: "member", order: 1, routes: ["dashboard"] },
      { runName: "admin", order: 2, routes: ["dashboard"] },
    ];

    const captures = planRunCaptures(buildExecutionPlan(runs, routes), {
      outputDirectory: "/out",
      structure: "run",
      runId: "2026",
    });

    const expectedPath = join("/out", "run", "2026", "dashboard", "page.png");
    expect(captures.every((c) => c.filePath === expectedPath)).toBe(true);

    const groups = detectCollisions(captures);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.captures.map((c) => c.runName)).toEqual(["member", "admin"]);
  });

  it("génère des captureId uniques pour des captures distinctes", () => {
    const routes = [route("dashboard", "/dashboard")];
    const runs: RawRun[] = [
      { runName: "member", order: 1, routes: ["dashboard"] },
      { runName: "admin", order: 2, routes: ["dashboard"] },
    ];

    const captures = planRunCaptures(buildExecutionPlan(runs, routes), {
      outputDirectory: "/out",
      structure: "run",
      runId: "2026",
    });

    expect(new Set(captures.map((c) => c.captureId)).size).toBe(captures.length);
  });
});
