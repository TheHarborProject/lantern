import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/load-config.js";
import { InitError } from "../errors/init-error.js";
import { configSchema } from "../schemas/config.js";
import {
  createMinimalInitConfig,
  discoverSourceDirectoryCandidates,
  initProject,
  inspectInitProject,
  prioritizeStartScripts,
  type InitPrompter,
} from "./init-project.js";

describe("lantern init domain", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-init-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates a minimal schema-valid config for a normal dev project", async () => {
    writePackageJson(root, { dev: "vite" });

    const result = await initProject(root, selecting("dev"));
    const content = readFileSync(join(root, ".lantern", "config.json"), "utf-8");

    expect(result.status).toBe("created");
    expect(content).toBe('{\n  "project": {\n    "startScript": "dev"\n  }\n}\n');
    expect(configSchema.safeParse(JSON.parse(content)).success).toBe(true);
    expect(JSON.parse(content)).toEqual(createMinimalInitConfig(defaultChoices()));
  });

  it("prioritizes likely scripts, keeps custom scripts selectable, and deprioritizes tooling", () => {
    expect(prioritizeStartScripts(["test", "launch:local", "storybook", "dev", "build", "serve"]))
      .toEqual(["dev", "serve", "storybook", "launch:local", "build", "test"]);
  });

  it("writes an arbitrary selected package script", async () => {
    writePackageJson(root, { test: "vitest", "launch:local": "custom-server" });

    await initProject(root, selecting("launch:local"));

    expect(readConfig(root)).toEqual({ project: { startScript: "launch:local" } });
  });

  it("leaves an existing config untouched without prompting", async () => {
    writePackageJson(root, { dev: "vite" });
    mkdirSync(join(root, ".lantern"));
    writeFileSync(join(root, ".lantern", "config.json"), "existing\n");
    const prompter = prompting();
    const selectStartScript = vi.spyOn(prompter, "selectStartScript");

    const result = await initProject(root, prompter);

    expect(result.status).toBe("already-configured");
    expect(selectStartScript).not.toHaveBeenCalled();
    expect(readFileSync(join(root, ".lantern", "config.json"), "utf-8")).toBe("existing\n");
  });

  it("treats legacy conventional config names as already configured", async () => {
    writePackageJson(root, { dev: "vite" });
    writeFileSync(join(root, "lantern.config.json"), "legacy\n");

    const result = await initProject(root, selecting("dev"));

    expect(result.status).toBe("already-configured");
    expect(readFileSync(join(root, "lantern.config.json"), "utf-8")).toBe("legacy\n");
  });

  it("reports a missing package.json", () => {
    expect(() => inspectInitProject(root)).toThrowError(InitError);
    expect(() => inspectInitProject(root)).toThrow(/No package.json was found/);
  });

  it("reports package.json files without scripts or with empty scripts", async () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app" }));
    await expect(initProject(root, selecting("dev"))).rejects.toThrow(/No package.json scripts/);

    writePackageJson(root, {});
    await expect(initProject(root, selecting("dev"))).rejects.toThrow(/No package.json scripts/);
  });

  it("reports malformed package.json", () => {
    writeFileSync(join(root, "package.json"), "{ nope");
    expect(() => inspectInitProject(root)).toThrow(/Could not parse/);
  });

  it("does not create configuration when the prompt is cancelled", async () => {
    writePackageJson(root, { dev: "vite" });

    const result = await initProject(root, selecting(undefined));

    expect(result).toEqual({ status: "cancelled" });
    expect(() => readConfig(root)).toThrow();
  });

  it("suggests existing source directories and defaults to a detected src choice", async () => {
    writePackageJson(root, { dev: "vite" });
    mkdirSync(join(root, "src", "components"), { recursive: true });
    mkdirSync(join(root, "packages"));
    const prompter = prompting({ sourceDirectory: "src" });
    const selectSourceDirectory = vi.spyOn(prompter, "selectSourceDirectory");

    await initProject(root, prompter);

    expect(discoverSourceDirectoryCandidates(root)).toEqual(["src", "src/components", "packages"]);
    expect(selectSourceDirectory).toHaveBeenCalledWith(["src", "src/components", "packages"]);
    expect(readConfig(root)).toEqual({ project: { startScript: "dev", sourceDirectory: "src" } });
  });

  it("serializes a valid custom source location", async () => {
    writePackageJson(root, { dev: "vite" });
    mkdirSync(join(root, "ui"));

    await initProject(root, prompting({ sourceDirectory: "ui" }));

    expect(readConfig(root)).toEqual({ project: { startScript: "dev", sourceDirectory: "ui" } });
  });

  it("rejects a custom source path outside the project or missing from disk", async () => {
    writePackageJson(root, { dev: "vite" });

    await expect(initProject(root, prompting({ sourceDirectory: "../elsewhere" }))).rejects.toThrow(/inside the project root/);
    await expect(initProject(root, prompting({ sourceDirectory: "missing" }))).rejects.toThrow(/does not exist/);
  });

  it("omits the default standard and an empty ignore selection", async () => {
    writePackageJson(root, { dev: "vite" });

    await initProject(root, prompting());

    expect(readConfig(root)).toEqual({ project: { startScript: "dev" } });
  });

  it("serializes a supported non-default standard", async () => {
    writePackageJson(root, { dev: "vite" });

    await initProject(root, prompting({ standard: "wcag21-aa" }));

    expect(readConfig(root)).toEqual({ project: { startScript: "dev" }, standards: ["wcag21-aa"] });
  });

  it("serializes only non-default output modes", async () => {
    writePackageJson(root, { dev: "vite" });
    await initProject(root, prompting({ outputMode: "minimal" }));
    expect(readConfig(root)).toEqual({ project: { startScript: "dev" }, output: { mode: "minimal" } });
  });

  it("serializes one trimmed ignore pattern", async () => {
    writePackageJson(root, { dev: "vite" });

    await initProject(root, prompting({ addIgnores: true, ignorePatterns: ["  src/generated/**  "] }));

    expect(readConfig(root)).toEqual({ project: { startScript: "dev" }, ignorePatterns: ["src/generated/**"] });
  });

  it("serializes multiple ignore patterns and drops empty entries cleanly", async () => {
    writePackageJson(root, { dev: "vite" });

    await initProject(root, prompting({
      addIgnores: true,
      ignorePatterns: ["src/generated/**", "  ", "**/*.generated.tsx"],
    }));

    expect(readConfig(root)).toEqual({
      project: { startScript: "dev" },
      ignorePatterns: ["src/generated/**", "**/*.generated.tsx"],
    });
  });

  it("cancels during a later prompt without creating a partial config", async () => {
    writePackageJson(root, { dev: "vite" });
    const prompter = prompting();
    vi.spyOn(prompter, "selectStandard").mockResolvedValue(undefined);

    expect(await initProject(root, prompter)).toEqual({ status: "cancelled" });
    expect(() => readConfig(root)).toThrow();
  });

  it("uses shared package-manager resolution and reports safe detections", async () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@10.0.0", scripts: { dev: "vite" } }));
    mkdirSync(join(root, "src"));
    const detections: string[] = [];

    const inspection = inspectInitProject(root);
    await initProject(root, selecting("dev"), (message) => detections.push(message));

    expect(inspection.packageManager).toBe("pnpm");
    expect(detections).toEqual(["Detected pnpm", "Found project configuration", "Found source directory: src"]);
  });

  it("uses the nearest package.json when invoked from a nested directory", async () => {
    writePackageJson(root, { dev: "vite" });
    const nested = join(root, "packages", "ui", "src");
    mkdirSync(nested, { recursive: true });

    const result = await initProject(nested, selecting("dev"));

    expect(result.status).toBe("created");
    expect(readConfig(root)).toEqual({ project: { startScript: "dev" } });
  });

  it("loads .lantern/config.json with paths rooted at the containing project", async () => {
    writePackageJson(root, { dev: "vite" });
    await initProject(root, selecting("dev"));

    const config = loadConfig({ cwd: root });

    expect(config.project.root).toBe(root);
    expect(config.project.workingDirectory).toBe(root);
  });
});

function selecting(value: string | undefined): InitPrompter {
  return prompting({ startScript: value });
}

interface PromptOverrides {
  readonly startScript?: string | undefined;
  readonly sourceDirectory?: string | undefined;
  readonly standard?: "wcag21-a" | "wcag21-aa" | "wcag22-a" | "wcag22-aa" | "rgaa4.1" | undefined;
  readonly addIgnores?: boolean | undefined;
  readonly ignorePatterns?: readonly (string | undefined)[];
  readonly outputMode?: "minimal" | "compact" | "verbose" | undefined;
}

function prompting(overrides: PromptOverrides = {}): InitPrompter {
  const patterns = [...(overrides.ignorePatterns ?? [])];
  let patternIndex = 0;
  return {
    selectStartScript: vi.fn(() => Promise.resolve("startScript" in overrides ? overrides.startScript : "dev")),
    selectSourceDirectory: vi.fn(() => Promise.resolve("sourceDirectory" in overrides ? overrides.sourceDirectory : ".")),
    selectStandard: vi.fn(() => Promise.resolve("standard" in overrides ? overrides.standard : "wcag22-aa")),
    selectOutputMode: vi.fn(() => Promise.resolve("outputMode" in overrides ? overrides.outputMode : "compact")),
    confirmIgnorePatterns: vi.fn(() => Promise.resolve("addIgnores" in overrides ? overrides.addIgnores : false)),
    inputIgnorePattern: vi.fn(() => Promise.resolve(patterns[patternIndex++])),
    confirmAnotherIgnorePattern: vi.fn(() => Promise.resolve(patternIndex < patterns.length)),
  };
}

function defaultChoices(): Parameters<typeof createMinimalInitConfig>[0] {
  return { startScript: "dev", sourceDirectory: ".", standard: "wcag22-aa", outputMode: "compact", ignorePatterns: [] };
}

function writePackageJson(directory: string, scripts: Record<string, string>): void {
  writeFileSync(join(directory, "package.json"), JSON.stringify({ name: "app", scripts }));
}

function readConfig(directory: string): unknown {
  return JSON.parse(readFileSync(join(directory, ".lantern", "config.json"), "utf-8"));
}
