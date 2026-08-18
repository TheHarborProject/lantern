import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config/load-config.js";
import { scanProject } from "../scan/scan-service.js";
import { resolveInteractiveScan } from "./scan-policy.js";
import type { ResolvedConfig } from "../types/config.js";
import type { StaleScanChoice } from "./types.js";

describe("interactive scan policy", () => {
  const roots: string[] = [];
  afterEach(() => { roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })); });
  function project(survey: object = {}): { readonly root: string; readonly config: ResolvedConfig } {
    const root = mkdtempSync(join(tmpdir(), "lantern-interactive-scan-")); roots.push(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, survey, engines: { static: false, rendered: false, axe: false, lighthouse: false } }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    return { root, config: loadConfig({ cwd: root }) };
  }
  const prompt = (choice: StaleScanChoice): { chooseStaleScan: () => Promise<StaleScanChoice> } => ({ chooseStaleScan: (): Promise<StaleScanChoice> => Promise.resolve(choice) });
  it("scans a missing project by default and honors missing error", async () => {
    const first = project();
    expect(await resolveInteractiveScan(first.config, prompt("refresh"))).toMatchObject({ scan: { refreshed: true }, effectivePolicy: "refresh" });
    const second = project({ scan: { interactive: { missing: "error" } } });
    await expect(resolveInteractiveScan(second.config, prompt("refresh"))).rejects.toThrow(/does not permit scanning/);
  });
  it("supports stale prompt refresh, current, and cancellation", async () => {
    for (const choice of ["refresh", "current", "cancel"] as const) {
      const fixture = project();
      scanProject({ root: fixture.root, sourceDirectory: fixture.root, ignorePatterns: [] });
      writeFileSync(join(fixture.root, "Button.tsx"), `export const Button = () => <button data-choice="${choice}" />;`);
      const result = await resolveInteractiveScan(fixture.config, prompt(choice));
      if (choice === "cancel") expect(result).toBeNull();
      else expect(result).toMatchObject({ scan: { refreshed: choice === "refresh", wasStale: true }, effectivePolicy: choice });
    }
  });
});
