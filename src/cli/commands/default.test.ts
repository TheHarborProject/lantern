import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startFakeSnapshotServer,
  type FakeSnapshotServer,
} from "../../testing/fake-snapshot-server.js";
import { createProgram } from "../program.js";

describe("registerDefaultCommand", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    process.exitCode = undefined;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it("enregistre les options --config, --runName, --partial, --route, --user sur le programme racine", () => {
    const program = createProgram();
    const longNames = program.options.map((option) => option.long);

    expect(longNames).toEqual(
      expect.arrayContaining(["--config", "--runName", "--partial", "--route", "--user"]),
    );
  });

  it("rejette --partial sans --runName avec un code de sortie 1 (conflit explicite)", async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["--partial"], { from: "user" });

    expect(process.exitCode).toBe(1);
    const message = String(errorSpy.mock.calls[0]?.[0]);
    expect(message).toContain("--partial");
  });

  it("rejette --user sans --route avec un code de sortie 1 (conflit explicite)", async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["--user", "member"], { from: "user" });

    expect(process.exitCode).toBe(1);
    const message = String(errorSpy.mock.calls[0]?.[0]);
    expect(message).toContain("--user");
  });

  it("rejette --user combiné à --runName avec un code de sortie 1 (conflit explicite)", async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(
      ["--runName", "member", "--route", "/member/calendar", "--user", "member"],
      { from: "user" },
    );

    expect(process.exitCode).toBe(1);
    const message = String(errorSpy.mock.calls[0]?.[0]);
    expect(message).toContain("--runName");
  });

  it("affiche la pile d'appels en plus du message avec --debug sur un conflit d'options", async () => {
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["--debug", "--partial"], { from: "user" });

    expect(process.exitCode).toBe(1);
    expect(errorSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("ne route pas 'scan' vers l'action par défaut", () => {
    const program = createProgram();

    const scanCommand = program.commands.find((command) => command.name() === "scan");
    expect(scanCommand).toBeDefined();
  });

  describe("codes de sortie", () => {
    let server: FakeSnapshotServer;
    let dir: string;
    const originalCwd = process.cwd();

    beforeEach(async () => {
      server = await startFakeSnapshotServer();
      dir = mkdtempSync(join(tmpdir(), "snaprun-cli-exit-code-"));
      process.chdir(dir);
    });

    afterEach(async () => {
      process.chdir(originalCwd);
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    });

    function writeConfig(config: Record<string, unknown>): void {
      writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify(config, null, 2));
    }

    it("code de sortie 0 après un succès complet", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync([], { from: "user" });

      expect(process.exitCode).toBe(0);
    });

    it("code de sortie non nul quand aucune configuration n'est trouvée", async () => {
      const program = createProgram();
      program.exitOverride();
      await program.parseAsync([], { from: "user" });

      expect(process.exitCode).not.toBe(0);
    });

    it("code de sortie non nul quand le rapport contient une capture en échec", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [
          {
            id: "bad",
            path: "/home",
            enableSnapshot: true,
            snapshotPath: "http://127.0.0.1:1/unreachable",
          },
        ],
        runs: [],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync([], { from: "user" });

      expect(process.exitCode).not.toBe(0);
    });

    it("--debug ne change jamais le code de sortie, seulement le niveau de détail affiché", async () => {
      const programWithoutDebug = createProgram();
      programWithoutDebug.exitOverride();
      await programWithoutDebug.parseAsync([], { from: "user" });
      const exitCodeWithoutDebug = process.exitCode;
      const callsWithoutDebug = errorSpy.mock.calls.length;

      errorSpy.mockClear();
      process.exitCode = undefined;

      const programWithDebug = createProgram();
      programWithDebug.exitOverride();
      await programWithDebug.parseAsync(["--debug"], { from: "user" });
      const exitCodeWithDebug = process.exitCode;
      const callsWithDebug = errorSpy.mock.calls.length;

      expect(exitCodeWithoutDebug).not.toBe(0);
      expect(exitCodeWithDebug).toBe(exitCodeWithoutDebug);
      expect(callsWithDebug).toBeGreaterThan(callsWithoutDebug);
    });
  });
});
