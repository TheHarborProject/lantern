import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePackageManager } from "./resolve-package-manager.js";

describe("resolvePackageManager", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "lantern-package-manager-"));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("priorise le champ packageManager du package.json", () => {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ packageManager: "yarn@4.5.0" }),
    );
    writeFileSync(join(directory, "pnpm-lock.yaml"), "");

    expect(resolvePackageManager(directory)).toBe("yarn");
  });

  it.each([
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
  ] as const)("détecte %s", (lockfile, expected) => {
    writeFileSync(join(directory, lockfile), "");

    expect(resolvePackageManager(directory)).toBe(expected);
  });

  it("remonte au gestionnaire déclaré par la racine d'un workspace", () => {
    const workspace = join(directory, "packages", "web");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.0.0" }),
    );
    writeFileSync(join(workspace, "package-lock.json"), "{}");

    expect(resolvePackageManager(workspace)).toBe("pnpm");
  });

  it("utilise npm sans déclaration ni lockfile", () => {
    expect(resolvePackageManager(directory)).toBe("npm");
  });
});
