import { describe, expect, it } from "vitest";
import { detectCollisions } from "./detect-collisions.js";
import type { RunCapturePlan } from "./types.js";

function capture(overrides: Partial<RunCapturePlan> & Pick<RunCapturePlan, "filePath" | "order">): RunCapturePlan {
  return {
    captureId: overrides.captureId ?? `c${String(overrides.order)}`,
    runName: overrides.runName ?? "run",
    routeId: overrides.routeId ?? "route",
    index: overrides.index ?? 1,
    plannedRoute: overrides.plannedRoute ?? ({} as RunCapturePlan["plannedRoute"]),
    ...overrides,
  };
}

describe("detectCollisions", () => {
  it("ne détecte aucune collision quand tous les chemins diffèrent", () => {
    const captures = [
      capture({ filePath: "/out/a.png", order: 1 }),
      capture({ filePath: "/out/b.png", order: 2 }),
    ];

    expect(detectCollisions(captures)).toEqual([]);
  });

  it("détecte un groupe pour deux captures partageant le même chemin", () => {
    const captures = [
      capture({ filePath: "/out/dashboard.png", order: 1, runName: "member", routeId: "dashboard" }),
      capture({ filePath: "/out/dashboard.png", order: 2, runName: "admin", routeId: "dashboard" }),
    ];

    const groups = detectCollisions(captures);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.filePath).toBe("/out/dashboard.png");
    expect(groups[0]?.captures.map((c) => c.runName)).toEqual(["member", "admin"]);
  });

  it("détecte plusieurs groupes et les ordonne par chemin (déterministe)", () => {
    const captures = [
      capture({ filePath: "/out/z.png", order: 1 }),
      capture({ filePath: "/out/a.png", order: 2 }),
      capture({ filePath: "/out/z.png", order: 3 }),
      capture({ filePath: "/out/a.png", order: 4 }),
      capture({ filePath: "/out/unique.png", order: 5 }),
    ];

    const groups = detectCollisions(captures);

    expect(groups.map((g) => g.filePath)).toEqual(["/out/a.png", "/out/z.png"]);
  });

  it("ordonne les captures d'un groupe par ordre global, indépendamment de l'entrée", () => {
    const captures = [
      capture({ filePath: "/out/x.png", order: 3, captureId: "third" }),
      capture({ filePath: "/out/x.png", order: 1, captureId: "first" }),
      capture({ filePath: "/out/x.png", order: 2, captureId: "second" }),
    ];

    const groups = detectCollisions(captures);

    expect(groups[0]?.captures.map((c) => c.captureId)).toEqual(["first", "second", "third"]);
  });
});
