import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigAlreadyExistsError } from "../errors/config-already-exists-error.js";
import { createConfigFile } from "./create-config-file.js";

describe("createConfigFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-create-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("écrit un JSON lisible avec deux espaces et un saut de ligne final", () => {
    const filePath = join(dir, "snaprun.config.json");

    createConfigFile(filePath, { project: { root: "." }, routes: [] });

    const content = readFileSync(filePath, "utf-8");
    expect(content.endsWith("\n")).toBe(true);
    expect(content).toContain('  "project"');
    expect(JSON.parse(content)).toEqual({ project: { root: "." }, routes: [] });
  });

  it("refuse d'écraser un fichier existant (RFC-013 §13)", () => {
    const filePath = join(dir, "snaprun.config.json");
    writeFileSync(filePath, "{}");

    expect(() => createConfigFile(filePath, { project: {} })).toThrow(ConfigAlreadyExistsError);
    expect(readFileSync(filePath, "utf-8")).toBe("{}");
  });

  it("expose le code CONFIG_ALREADY_EXISTS", () => {
    const filePath = join(dir, "snaprun.config.json");
    writeFileSync(filePath, "{}");

    try {
      createConfigFile(filePath, {});
      expect.fail("createConfigFile aurait dû lever une erreur");
    } catch (error) {
      expect((error as ConfigAlreadyExistsError).code).toBe("CONFIG_ALREADY_EXISTS");
    }
  });
});
