import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "../../runs/build-execution-plan.js";
import type { RawRoute } from "../../types/route.js";
import type { RawRun } from "../../types/run.js";
import { detectCollisions } from "./detect-collisions.js";
import { planRunCaptures } from "./plan-run-captures.js";
import { buildSubfolderPaths } from "./subfolder-paths.js";
import type { CollisionGroup, RunCapturePlan } from "./types.js";

function capture(captureId: string, runName: string, filePath: string, order: number): RunCapturePlan {
  return {
    captureId,
    filePath,
    runName,
    routeId: "dashboard",
    index: 1,
    order,
    plannedRoute: {} as RunCapturePlan["plannedRoute"],
  };
}

/**
 * Resolve, end to end, the "Create subfolders" path for the `dashboard` route
 * of each run, given a plan composition. Uses structure `run` (path omits the
 * run name, so shared route ids collide across runs).
 */
function resolvedDashboardPaths(routes: RawRoute[], runs: RawRun[]): Map<string, string> {
  const captures = planRunCaptures(buildExecutionPlan(runs, routes), {
    outputDirectory: "/out",
    structure: "run",
    runId: "R",
  });
  const relocated = buildSubfolderPaths(detectCollisions(captures));

  const byRun = new Map<string, string>();
  for (const capture of captures) {
    if (capture.routeId === "dashboard") {
      const path = relocated.get(capture.captureId);
      if (path !== undefined) {
        byRun.set(capture.runName, path);
      }
    }
  }
  return byRun;
}

const DASHBOARD: RawRoute = { id: "dashboard", path: "/dashboard", enableSnapshot: true };
const HOME: RawRoute = { id: "home", path: "/home", enableSnapshot: true };

describe("buildSubfolderPaths", () => {
  it("insère le nom du run comme sous-dossier déterministe avant la route", () => {
    const path = join("/out", "run", "2026", "dashboard", "page.png");
    const groups: CollisionGroup[] = [
      { filePath: path, captures: [capture("m", "member", path, 1), capture("a", "admin", path, 2)] },
    ];

    const relocated = buildSubfolderPaths(groups);

    expect(relocated.get("m")).toBe(join("/out", "run", "2026", "member", "dashboard", "page.png"));
    expect(relocated.get("a")).toBe(join("/out", "run", "2026", "admin", "dashboard", "page.png"));
  });

  it("n'utilise aucun index de position : deux captures du même run donnent le même chemin", () => {
    const path = join("/out", "run", "2026", "dashboard", "page.png");
    // Même run listant la route deux fois : identité métier identique -> même chemin.
    const groups: CollisionGroup[] = [
      { filePath: path, captures: [capture("first", "dup", path, 1), capture("second", "dup", path, 2)] },
    ];

    const relocated = buildSubfolderPaths(groups);

    const expected = join("/out", "run", "2026", "dup", "dashboard", "page.png");
    expect(relocated.get("first")).toBe(expected);
    expect(relocated.get("second")).toBe(expected);
  });

  it("donne des chemins uniques aux runs distincts d'un groupe", () => {
    const path = join("/out", "run", "2026", "dashboard", "page.png");
    const groups: CollisionGroup[] = [
      {
        filePath: path,
        captures: [
          capture("m", "member", path, 1),
          capture("a", "admin", path, 2),
          capture("g", "guest", path, 3),
        ],
      },
    ];

    expect(new Set(buildSubfolderPaths(groups).values()).size).toBe(3);
  });

  describe("stabilité de l'identité (RFC-014.5 §8)", () => {
    const expected = new Map([
      ["member", join("/out", "run", "R", "member", "dashboard", "page.png")],
      ["admin", join("/out", "run", "R", "admin", "dashboard", "page.png")],
    ]);

    it("reste identique quand l'ordre du plan change", () => {
      const forward = resolvedDashboardPaths(
        [DASHBOARD],
        [
          { runName: "member", order: 1, routes: ["dashboard"] },
          { runName: "admin", order: 2, routes: ["dashboard"] },
        ],
      );
      const reversed = resolvedDashboardPaths(
        [DASHBOARD],
        [
          { runName: "admin", order: 1, routes: ["dashboard"] },
          { runName: "member", order: 2, routes: ["dashboard"] },
        ],
      );

      expect(forward).toEqual(expected);
      expect(reversed).toEqual(expected);
    });

    it("reste identique quand un run non conflictuel est inséré avant", () => {
      const withExtra = resolvedDashboardPaths(
        [DASHBOARD, HOME],
        [
          { runName: "extra", order: 1, routes: ["home"] },
          { runName: "member", order: 2, routes: ["dashboard"] },
          { runName: "admin", order: 3, routes: ["dashboard"] },
        ],
      );

      expect(withExtra).toEqual(expected);
    });

    it("reste identique quand un run non conflictuel est retiré", () => {
      const withoutExtra = resolvedDashboardPaths(
        [DASHBOARD],
        [
          { runName: "member", order: 5, routes: ["dashboard"] },
          { runName: "admin", order: 9, routes: ["dashboard"] },
        ],
      );

      expect(withoutExtra).toEqual(expected);
    });

    it("les jobs non conflictuels conservent leur chemin d'origine (aucune relocation)", () => {
      const captures = planRunCaptures(
        buildExecutionPlan(
          [
            { runName: "member", order: 1, routes: ["dashboard", "home"] },
            { runName: "admin", order: 2, routes: ["dashboard"] },
          ],
          [DASHBOARD, HOME],
        ),
        { outputDirectory: "/out", structure: "run", runId: "R" },
      );
      const relocated = buildSubfolderPaths(detectCollisions(captures));

      const homeCapture = captures.find((c) => c.routeId === "home");
      // 'home' n'est capturé que dans un seul run : hors collision, pas de relocation.
      expect(homeCapture !== undefined && relocated.has(homeCapture.captureId)).toBe(false);
    });
  });
});
