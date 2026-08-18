import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../program.js";

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
});
