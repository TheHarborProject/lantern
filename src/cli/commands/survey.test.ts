import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";
import type { InteractiveSurveyPrompter } from "../../interactive/types.js";
import type { SurveyRunV1 } from "../../survey/schema/survey-run.js";

describe("lantern survey", () => {
  let root: string;
  const cwd = process.cwd();
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-survey-cli-"));
    process.chdir(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, engines: { static: false, rendered: false, axe: false, lighthouse: false } }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
  });
  afterEach(() => { process.chdir(cwd); rmSync(root, { recursive: true, force: true }); vi.restoreAllMocks(); process.exitCode = undefined; });

  it("runs the canonical all-components workflow with name and output mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram(); program.exitOverride();
    await program.parseAsync(["survey", "--name", "baseline", "--compact", "--no-save"], { from: "user" });
    expect(log.mock.calls.map(([value]) => String(value)).join("\n")).toContain("Lantern survey");
    expect(process.exitCode).toBe(0);
    expect(existsSync(join(root, ".lantern", "surveys"))).toBe(false);
  });

  it("persists locally, disables saving in CI, and reports sink failures as operational", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    let program = createProgram(); program.exitOverride();
    await program.parseAsync(["survey", "--minimal"], { from: "user" });
    expect(readdirSync(join(root, ".lantern", "surveys")).filter((name) => name.endsWith(".json"))).toHaveLength(1);
    rmSync(join(root, ".lantern", "surveys"), { recursive: true, force: true });
    const previousCi = process.env.CI; process.env.CI = "true";
    program = createProgram(); program.exitOverride();
    await program.parseAsync(["survey", "--minimal"], { from: "user" });
    if (previousCi === undefined) delete process.env.CI; else process.env.CI = previousCi;
    expect(existsSync(join(root, ".lantern", "surveys"))).toBe(false);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    program = createProgram({ surveySink: { save: () => Promise.reject(new Error("disk full")) } }); program.exitOverride();
    await program.parseAsync(["survey", "--minimal"], { from: "user" });
    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Could not persist finalized survey"));
  });

  it("rejects path and --since before a run starts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const program = createProgram(); program.exitOverride();
    await program.parseAsync(["survey", "Button.tsx", "--since", "HEAD"], { from: "user" });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Cannot combine"));
    expect(process.exitCode).toBe(2);
  });

  it("runs interactive selection through the canonical survey and persistence path", async () => {
    const runs: SurveyRunV1[] = [];
    const prompter: InteractiveSurveyPrompter = {
      chooseStaleScan: () => Promise.resolve("refresh"),
      chooseComponents: (components) => Promise.resolve([components[0]?.id ?? ""]),
      refineStates: (components, selection) => Promise.resolve({ componentIds: selection.componentIds, states: { kind: "restricted", ids: [components[0]?.states[0]?.id ?? ""] } }),
      confirmPlan: () => Promise.resolve("start"),
    };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram({ interactivePrompter: prompter, isInteractiveTerminal: () => true, surveySink: { save: (run) => { runs.push(run); return Promise.resolve(); } } });
    program.exitOverride();
    await program.parseAsync(["survey", "-i", "--name", "chosen", "--minimal"], { from: "user" });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ name: "chosen", targeting: { source: "interactive", componentIds: ["Button.tsx#Button"] } });
    expect(runs[0]?.targeting.stateIds).toHaveLength(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Components"));
  });

  it("fails non-TTY and conflicting targeting before creating a run", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let program = createProgram({ isInteractiveTerminal: () => false }); program.exitOverride();
    await program.parseAsync(["survey", "-i"], { from: "user" });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("requires an interactive"));
    process.exitCode = undefined;
    program = createProgram({ isInteractiveTerminal: () => true }); program.exitOverride();
    await program.parseAsync(["survey", "-i", "Button.tsx"], { from: "user" });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("cannot be combined"));
  });

  it("creates no run on pre-run cancellation and honors --no-save", async () => {
    const saved: SurveyRunV1[] = [];
    const cancelled: InteractiveSurveyPrompter = {
      chooseStaleScan: () => Promise.resolve("refresh"), chooseComponents: () => Promise.resolve(null),
      refineStates: (_components, selection) => Promise.resolve(selection), confirmPlan: () => Promise.resolve("start"),
    };
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    let program = createProgram({ interactivePrompter: cancelled, isInteractiveTerminal: () => true, surveySink: { save: (run) => { saved.push(run); return Promise.resolve(); } } }); program.exitOverride();
    await program.parseAsync(["survey", "-i"], { from: "user" });
    expect(saved).toHaveLength(0);
    const start: InteractiveSurveyPrompter = { ...cancelled, chooseComponents: (components) => Promise.resolve(components.map(({ id }) => id)) };
    program = createProgram({ interactivePrompter: start, isInteractiveTerminal: () => true, surveySink: { save: (run) => { saved.push(run); return Promise.resolve(); } } }); program.exitOverride();
    await program.parseAsync(["survey", "-i", "--no-save", "--minimal"], { from: "user" });
    expect(saved).toHaveLength(0);
  });
});
