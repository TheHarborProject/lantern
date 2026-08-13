import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigNotFoundError } from "../errors/config-not-found-error.js";
import { findConfigFile } from "./find-config-file.js";

describe("findConfigFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-find-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("détecte snaprun.config.json en priorité", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{}");
    writeFileSync(join(dir, "snapshot.config.json"), "{}");
    writeFileSync(join(dir, "settings.json"), "{}");

    expect(findConfigFile({ cwd: dir })).toBe(join(dir, "snaprun.config.json"));
  });

  it("détecte snapshot.config.json si snaprun.config.json est absent", () => {
    writeFileSync(join(dir, "snapshot.config.json"), "{}");
    writeFileSync(join(dir, "settings.json"), "{}");

    expect(findConfigFile({ cwd: dir })).toBe(join(dir, "snapshot.config.json"));
  });

  it("détecte settings.json en dernier recours", () => {
    writeFileSync(join(dir, "settings.json"), "{}");

    expect(findConfigFile({ cwd: dir })).toBe(join(dir, "settings.json"));
  });

  it("lève CONFIG_NOT_FOUND si aucun fichier n'est trouvé", () => {
    expect(() => findConfigFile({ cwd: dir })).toThrow(ConfigNotFoundError);
  });

  it("priorise le chemin explicite (--config) sur la détection automatique", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{}");
    writeFileSync(join(dir, "custom.json"), "{}");

    const result = findConfigFile({ cwd: dir, explicitPath: "custom.json" });

    expect(result).toBe(join(dir, "custom.json"));
  });

  it("résout un chemin explicite absolu", () => {
    const explicitFile = join(dir, "custom.json");
    writeFileSync(explicitFile, "{}");

    expect(findConfigFile({ cwd: dir, explicitPath: explicitFile })).toBe(explicitFile);
  });

  it("lève CONFIG_NOT_FOUND si le chemin explicite n'existe pas", () => {
    expect(() => findConfigFile({ cwd: dir, explicitPath: "absent.json" })).toThrow(
      ConfigNotFoundError,
    );
  });
});
