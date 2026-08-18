import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config/load-config.js";
import type { InteractiveSurveyPrompter, PlanChoice } from "./types.js";
import { prepareInteractiveSurvey } from "./workflow.js";
import type { ResolvedConfig } from "../types/config.js";

describe("interactive pre-run workflow", () => {
  const roots: string[] = [];
  afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
  function fixture(confirm = true): ResolvedConfig {
    const root = mkdtempSync(join(tmpdir(), "lantern-interactive-workflow-")); roots.push(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, survey: { interactive: { confirm } }, engines: { static: false, rendered: false, axe: false, lighthouse: false } }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = ({ disabled = false }: { disabled?: boolean }) => <button disabled={disabled} />;");
    return loadConfig({ cwd: root });
  }
  function prompter(choices: PlanChoice[]): InteractiveSurveyPrompter {
    return {
      chooseStaleScan: () => Promise.resolve("refresh"),
      chooseComponents: (components) => Promise.resolve(components.map(({ id }) => id)),
      refineStates: (_components, selection) => Promise.resolve(selection),
      confirmPlan: () => Promise.resolve(choices.shift() ?? "start"),
    };
  }
  it("supports confirmation back and then start", async () => {
    const prepared = await prepareInteractiveSurvey({ config: fixture(), prompter: prompter(["back", "start"]), save: true });
    expect(prepared?.selection.componentIds).toEqual(["Button.tsx#Button"]);
  });
  it("cancels before the run boundary", async () => {
    expect(await prepareInteractiveSurvey({ config: fixture(), prompter: prompter(["cancel"]), save: true })).toBeNull();
  });
  it("skips confirmation when disabled", async () => {
    let confirmed = false;
    const adapter = prompter([]);
    const prepared = await prepareInteractiveSurvey({ config: fixture(false), prompter: { ...adapter, confirmPlan: () => { confirmed = true; return Promise.resolve("cancel"); } }, save: false });
    expect(prepared).not.toBeNull();
    expect(confirmed).toBe(false);
  });
});
