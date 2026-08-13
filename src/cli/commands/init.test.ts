import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configSchema } from "../../schemas/config.js";
import { createProgram } from "../program.js";
import { registerInitCommand } from "./init.js";

describe("registerInitCommand", () => {
  it("enregistre la commande 'init'", () => {
    const program = new Command();
    registerInitCommand(program);

    expect(program.commands.map((command) => command.name())).toContain("init");
  });
});

describe("snaprun init", () => {
  let dir: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-init-"));
    process.chdir(dir);
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function runInit(): Promise<void> {
    const program = createProgram();
    program.exitOverride();
    await program.parseAsync(["init"], { from: "user" });
  }

  it("crée snaprun.config.json dans le répertoire courant", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runInit();

    expect(existsSync(join(dir, "snaprun.config.json"))).toBe(true);
    expect(log).toHaveBeenCalledWith("✔ Created snaprun.config.json");
    expect(process.exitCode ?? 0).toBe(0);
  });

  it("génère un JSON valide qui satisfait configSchema (RFC-013 §14)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runInit();

    const raw = readFileSync(join(dir, "snaprun.config.json"), "utf-8");
    const data: unknown = JSON.parse(raw);

    expect(configSchema.safeParse(data).success).toBe(true);
  });

  it("représente tous les domaines de configuration de premier niveau", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runInit();

    const data = JSON.parse(readFileSync(join(dir, "snaprun.config.json"), "utf-8")) as Record<
      string,
      unknown
    >;

    expect(Object.keys(data).sort()).toEqual(
      ["auth", "execution", "output", "project", "routes", "runs"].sort(),
    );
    expect(data["routes"]).toEqual([]);
    expect(data["runs"]).toEqual([]);
    expect(data["execution"]).toEqual({ concurrency: 4, collisionStrategy: "prompt" });
  });

  it("n'écrase pas silencieusement un fichier existant (RFC-013 §13)", async () => {
    const existing = JSON.stringify({ project: { root: "./kept" } });
    writeFileSync(join(dir, "snaprun.config.json"), existing);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runInit();

    expect(readFileSync(join(dir, "snaprun.config.json"), "utf-8")).toBe(existing);
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith("✖ snaprun.config.json already exists");
  });
});
