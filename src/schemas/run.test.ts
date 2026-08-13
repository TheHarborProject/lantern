import { describe, expect, it } from "vitest";
import { runSchema, runsSchema } from "./run.js";

function run(overrides: Record<string, unknown> = {}): unknown {
  return {
    runName: "member",
    user: "member",
    order: 1,
    routes: ["member-home", "member-calendar"],
    ...overrides,
  };
}

describe("runSchema", () => {
  it("accepte un run complet", () => {
    expect(runSchema.safeParse(run()).success).toBe(true);
  });

  it("accepte un run public (sans 'user')", () => {
    const publicRun = run();
    delete (publicRun as Record<string, unknown>)["user"];

    expect(runSchema.safeParse(publicRun).success).toBe(true);
  });

  it("accepte un run sans route", () => {
    expect(runSchema.safeParse(run({ routes: [] })).success).toBe(true);
  });

  it("rejette une clé inconnue (validation stricte)", () => {
    expect(runSchema.safeParse(run({ unexpected: "value" })).success).toBe(false);
  });

  it("rejette un 'order' non numérique", () => {
    expect(runSchema.safeParse(run({ order: "1" })).success).toBe(false);
  });
});

describe("runsSchema", () => {
  it("accepte une liste de runs aux noms uniques", () => {
    const result = runsSchema.safeParse([run({ runName: "a" }), run({ runName: "b" })]);

    expect(result.success).toBe(true);
  });

  it("rejette une liste de runs avec un nom dupliqué", () => {
    const result = runsSchema.safeParse([
      run({ runName: "duplicate" }),
      run({ runName: "duplicate" }),
    ]);

    expect(result.success).toBe(false);
  });

  it("accepte une liste vide", () => {
    const result = runsSchema.safeParse([]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});
