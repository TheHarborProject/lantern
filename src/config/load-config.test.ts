import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigInvalidError } from "../errors/config-invalid-error.js";
import { ConfigNotFoundError } from "../errors/config-not-found-error.js";
import { loadConfig } from "./load-config.js";

interface ProjectOverrides {
  readonly root?: string;
  readonly workingDirectory?: string;
}

function validProject(overrides: ProjectOverrides = {}): Record<string, unknown> {
  return {
    root: ".",
    baseUrl: "http://localhost:3000",
    startCommand: "pnpm dev",
    autoStart: true,
    ...overrides,
  };
}

function validConfig(
  overrides: { project?: Record<string, unknown> } = {},
): Record<string, unknown> {
  return {
    project: overrides.project ?? validProject(),
    output: { directory: "./snapshots", fullPage: true },
    auth: {
      loginRoute: "/sign-in",
      selectors: {
        email: "input[name='email']",
        password: "input[name='password']",
        submit: "button[type='submit']",
      },
      successUrl: "/dashboard",
      users: {},
    },
    routes: [],
    runs: [],
  };
}

describe("loadConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-load-config-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("charge une configuration valide et résout project.root/workingDirectory sur '.'", () => {
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify(validConfig()));

    const result = loadConfig({ cwd: dir });

    expect(result.project.root).toBe(dir);
    expect(result.project.workingDirectory).toBe(dir);
    expect(result.configFilePath).toBe(join(dir, "snaprun.config.json"));
  });

  it("résout project.root relatif au répertoire du fichier de configuration", () => {
    mkdirSync(join(dir, "app"), { recursive: true });
    writeFileSync(
      join(dir, "snaprun.config.json"),
      JSON.stringify(validConfig({ project: validProject({ root: "./app" }) })),
    );

    const result = loadConfig({ cwd: dir });

    expect(result.project.root).toBe(join(dir, "app"));
    expect(result.project.workingDirectory).toBe(join(dir, "app"));
  });

  it("résout project.workingDirectory relatif à project.root quand il est fourni", () => {
    mkdirSync(join(dir, "app", "web"), { recursive: true });
    writeFileSync(
      join(dir, "snaprun.config.json"),
      JSON.stringify(
        validConfig({ project: validProject({ root: "./app", workingDirectory: "./web" }) }),
      ),
    );

    const result = loadConfig({ cwd: dir });

    expect(result.project.root).toBe(join(dir, "app"));
    expect(result.project.workingDirectory).toBe(join(dir, "app", "web"));
  });

  it("accepte project.root absolu", () => {
    const absoluteRoot = mkdtempSync(join(tmpdir(), "snaprun-absolute-root-"));

    writeFileSync(
      join(dir, "snaprun.config.json"),
      JSON.stringify(validConfig({ project: validProject({ root: absoluteRoot }) })),
    );

    const result = loadConfig({ cwd: dir });

    expect(result.project.root).toBe(resolve(absoluteRoot));

    rmSync(absoluteRoot, { recursive: true, force: true });
  });

  it("priorise --config sur la détection automatique", () => {
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify(validConfig()));
    mkdirSync(join(dir, "custom-root"), { recursive: true });
    writeFileSync(
      join(dir, "custom.json"),
      JSON.stringify(validConfig({ project: validProject({ root: "./custom-root" }) })),
    );

    const result = loadConfig({ cwd: dir, explicitPath: "custom.json" });

    expect(result.configFilePath).toBe(join(dir, "custom.json"));
    expect(result.project.root).toBe(join(dir, "custom-root"));
  });

  it("remembers a valid explicit config path after loading it successfully", () => {
    mkdirSync(join(dir, "config"), { recursive: true });
    writeFileSync(join(dir, "config", "snaprun.json"), JSON.stringify(validConfig()));

    loadConfig({ cwd: dir, explicitPath: "./config/snaprun.json" });

    const metadata = JSON.parse(readFileSync(join(dir, ".snaprun", "project.json"), "utf-8")) as {
      configPath: string;
    };

    expect(metadata.configPath).toBe("./config/snaprun.json");
  });

  it("lève CONFIG_NOT_FOUND si aucun fichier de configuration n'existe", () => {
    expect(() => loadConfig({ cwd: dir })).toThrow(ConfigNotFoundError);
  });

  it("lève CONFIG_INVALID sur un JSON malformé", () => {
    writeFileSync(join(dir, "snaprun.config.json"), "{ invalide");

    try {
      loadConfig({ cwd: dir });
      expect.fail("loadConfig aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigInvalidError);
      expect((error as ConfigInvalidError).code).toBe("CONFIG_INVALID");
      expect((error as ConfigInvalidError).cause).toBeInstanceOf(SyntaxError);
    }
  });

  it("lève CONFIG_INVALID sur une structure ne respectant pas le schéma", () => {
    const config = validConfig();
    config["output"] = { fullPage: "oui" };
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify(config));

    expect(() => loadConfig({ cwd: dir })).toThrow(ConfigInvalidError);
  });

  it("lève CONFIG_INVALID si la section 'project' est absente", () => {
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify({}));

    expect(() => loadConfig({ cwd: dir })).toThrow(ConfigInvalidError);
  });

  it("charge une configuration réellement minimale ({ project: {} }) avec toutes les valeurs par défaut", () => {
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify({ project: {} }));

    const result = loadConfig({ cwd: dir });

    expect(result.project.root).toBe(dir);
    expect(result.project.workingDirectory).toBe(dir);
    expect(result.project.autoStart).toBe(false);
    expect(result.project.baseUrl).toBeUndefined();
    expect(result.project.startCommand).toBeUndefined();
    expect(result.output).toEqual({ directory: "./snapshots", fullPage: true, structure: "flat" });
    expect(result.routes).toEqual([]);
    expect(result.runs).toEqual([]);
    expect(result.auth).toBeUndefined();
  });

  it("charge une configuration minimale suffisante pour un scan (project.baseUrl seul)", () => {
    writeFileSync(
      join(dir, "snaprun.config.json"),
      JSON.stringify({ project: { baseUrl: "http://localhost:3000" } }),
    );

    const result = loadConfig({ cwd: dir });

    expect(result.project.baseUrl).toBe("http://localhost:3000");
    expect(result.auth).toBeUndefined();
  });
});
