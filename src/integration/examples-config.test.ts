import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { configSchema } from "../schemas/config.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("examples/snapshot.config.json", () => {
  it("respecte le schéma de configuration (RFC-012)", () => {
    const raw = readFileSync(join(REPO_ROOT, "examples", "snapshot.config.json"), "utf-8");
    const data: unknown = JSON.parse(raw);

    const result = configSchema.safeParse(data);

    expect(result.success).toBe(true);
  });

  it("illustre les users member/admin, une route publique, une route dynamique et deux runs ordonnés", () => {
    const raw = readFileSync(join(REPO_ROOT, "examples", "snapshot.config.json"), "utf-8");
    const data: unknown = JSON.parse(raw);

    const result = configSchema.safeParse(data);
    if (!result.success) {
      throw new Error("la configuration d'exemple doit être valide");
    }

    expect(Object.keys(result.data.auth?.users ?? {}).sort()).toEqual(["admin", "member"]);
    expect(result.data.routes.some((route) => route.user === undefined)).toBe(true);
    expect(result.data.routes.some((route) => route.isDynamic === true)).toBe(true);
    expect(result.data.runs.map((run) => run.runName)).toEqual(["member", "admin"]);
    expect(result.data.runs.map((run) => run.order)).toEqual([1, 2]);
  });
});
