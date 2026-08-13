import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { computeSnapshotFilePath } from "./compute-snapshot-file-path.js";

describe("computeSnapshotFilePath", () => {
  it("calcule le chemin d'une route de run avec le préfixe numérique zéro-paddé", () => {
    const filePath = computeSnapshotFilePath("/out", {
      structure: "flat",
      kind: "run",
      runName: "member",
      index: 1,
      routeId: "member-home",
    });

    expect(filePath).toBe(["", "out", "member", "01-member-home.png"].join(sep));
  });

  it("n'ajoute pas de padding supplémentaire au-delà de 2 chiffres", () => {
    const filePath = computeSnapshotFilePath("/out", {
      structure: "flat",
      kind: "run",
      runName: "member",
      index: 123,
      routeId: "route",
    });

    expect(filePath).toBe(["", "out", "member", "123-route.png"].join(sep));
  });

  it("calcule le chemin d'une route standalone sans préfixe numérique", () => {
    const filePath = computeSnapshotFilePath("/out", {
      structure: "flat",
      kind: "standalone",
      routeId: "member-calendar",
    });

    expect(filePath).toBe(["", "out", "standalone", "member-calendar.png"].join(sep));
  });

  it("creates the nested run structure with a single run id", () => {
    const filePath = computeSnapshotFilePath("/out", {
      structure: "run",
      kind: "run",
      runName: "ignored-in-run-structure",
      index: 1,
      routeId: "member-home",
      runId: "2026-08-06_1856",
    });

    expect(filePath).toBe(["", "out", "run", "2026-08-06_1856", "member-home", "page.png"].join(sep));
  });

  it("creates the scope structure and falls back to unscoped", () => {
    const scopedFilePath = computeSnapshotFilePath("/out", {
      structure: "scope",
      kind: "standalone",
      routeId: "users",
      scope: "admin",
    });
    const unscopedFilePath = computeSnapshotFilePath("/out", {
      structure: "scope",
      kind: "standalone",
      routeId: "home",
    });

    expect(scopedFilePath).toBe(["", "out", "admin", "users", "page.png"].join(sep));
    expect(unscopedFilePath).toBe(["", "out", "unscoped", "home", "page.png"].join(sep));
  });

  it("normalizes spaces and special characters in generated segments", () => {
    const filePath = computeSnapshotFilePath("/out", {
      structure: "scope",
      kind: "standalone",
      routeId: "Member Stays!",
      scope: "Support Team",
    });

    expect(filePath).toBe(["", "out", "Support-Team", "Member-Stays", "page.png"].join(sep));
  });

  it("rejects path traversal attempts in route ids or scopes", () => {
    expect(() =>
      computeSnapshotFilePath("/out", {
        structure: "scope",
        kind: "standalone",
        routeId: "../escape",
      }),
    ).toThrow();

    expect(() =>
      computeSnapshotFilePath("/out", {
        structure: "scope",
        kind: "standalone",
        routeId: "home",
        scope: "..\\escape",
      }),
    ).toThrow();
  });
});
