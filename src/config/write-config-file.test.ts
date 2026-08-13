import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeConfigFile } from "./write-config-file.js";

describe("writeConfigFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-write-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("écrit les données en JSON lisible", () => {
    const filePath = join(dir, "snaprun.config.json");

    writeConfigFile(filePath, { project: { root: "." }, routes: [] });

    expect(JSON.parse(readFileSync(filePath, "utf-8"))).toEqual({
      project: { root: "." },
      routes: [],
    });
  });

  it("écrase un fichier existant", () => {
    const filePath = join(dir, "snaprun.config.json");
    writeFileSync(filePath, JSON.stringify({ project: { root: "." }, routes: [] }));

    writeConfigFile(filePath, { project: { root: "." }, routes: [{ id: "a" }] });

    expect(JSON.parse(readFileSync(filePath, "utf-8"))).toEqual({
      project: { root: "." },
      routes: [{ id: "a" }],
    });
  });

  it("ne laisse aucun fichier temporaire résiduel", () => {
    const filePath = join(dir, "snaprun.config.json");

    writeConfigFile(filePath, { project: { root: "." }, routes: [] });

    expect(readdirSync(dir)).toEqual(["snaprun.config.json"]);
  });
});
