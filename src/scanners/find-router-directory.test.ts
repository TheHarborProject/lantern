import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findRouterDirectory } from "./find-router-directory.js";

describe("findRouterDirectory", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-find-router-dir-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("retourne le premier candidat existant", async () => {
    mkdirSync(join(dir, "src", "app"), { recursive: true });

    await expect(findRouterDirectory(dir, ["app", "src/app"])).resolves.toBe(
      join(dir, "src", "app"),
    );
  });

  it("priorise 'app' sur 'src/app' quand les deux existent", async () => {
    mkdirSync(join(dir, "app"), { recursive: true });
    mkdirSync(join(dir, "src", "app"), { recursive: true });

    await expect(findRouterDirectory(dir, ["app", "src/app"])).resolves.toBe(join(dir, "app"));
  });

  it("retourne undefined si aucun candidat n'existe", async () => {
    await expect(findRouterDirectory(dir, ["app", "src/app"])).resolves.toBeUndefined();
  });
});
