import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../config/load-config.js";
import { resolveSurveyHistoryOptions } from "../../history/path.js";
import { saveSurveyRun } from "../../history/repository.js";
import { historyTestRun } from "../../testing/history-test-run.js";
import { createProgram } from "../program.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("survey history CLI", () => {
  let root: string;
  const cwd = process.cwd();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-history-cli-")); process.chdir(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, survey: { history: { path: ".history", listMax: 20 } } }));
    const store = resolveSurveyHistoryOptions(loadConfig({ cwd: root }));
    saveSurveyRun(store, historyTestRun(ID_A, "2026-01-01T00:00:00.000Z", { name: "old" }));
    saveSurveyRun(store, historyTestRun(ID_B, "2026-01-02T00:00:00.000Z", { name: "latest" }));
  });
  afterEach(() => { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); process.exitCode = undefined; });

  it("lists with --max and replays using only the stored run", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram(); program.exitOverride();
    await program.parseAsync(["list", "surveys", "--max", "1"], { from: "user" });
    const list = log.mock.calls.map(([value]) => String(value)).join("\n");
    expect(list).toContain("2222222"); expect(list).toContain("latest"); expect(list).not.toContain("old");
    log.mockClear();
    await program.parseAsync(["show", "last", "--verbose"], { from: "user" });
    expect(log.mock.calls.map(([value]) => String(value)).join("\n")).toContain("Name  latest");
  });

  it("exports the exact authoritative representation", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const program = createProgram(); program.exitOverride();
    await program.parseAsync(["export", "last"], { from: "user" });
    const exported = String(write.mock.calls[0]?.[0]);
    expect(JSON.parse(exported)).toMatchObject({ schema: "lantern-survey-run", version: 1, id: ID_B });
    expect(exported).toBe(readFileSync(join(root, ".history", `${ID_B}.json`), "utf8"));
  });

  it("confirms the concrete run and supports force deletion", async () => {
    const confirmation = vi.fn(() => Promise.resolve(false));
    let program = createProgram({ deleteConfirmation: confirmation }); program.exitOverride();
    await program.parseAsync(["delete", "last"], { from: "user" });
    expect(confirmation).toHaveBeenCalledWith(expect.objectContaining({ id: ID_B }));
    expect(existsSync(join(root, ".history", `${ID_B}.json`))).toBe(true);
    program = createProgram({ deleteConfirmation: confirmation }); program.exitOverride();
    await program.parseAsync(["delete", "last", "--force"], { from: "user" });
    expect(existsSync(join(root, ".history", `${ID_B}.json`))).toBe(false);
    expect(existsSync(join(root, ".history", `${ID_A}.json`))).toBe(true);
  });
});
