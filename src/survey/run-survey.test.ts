import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config/load-config.js";
import { renderSurveyRun } from "./render-survey-run.js";
import { runSurvey } from "./run-survey.js";

describe("runSurvey", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  it("returns the canonical named snapshot and renders without source access", async () => {
    const root = mkdtempSync(join(tmpdir(), "lantern-rfc010-survey-")); roots.push(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, engines: { static: false, rendered: false, axe: false, lighthouse: false } }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const config = loadConfig({ cwd: root });
    const events: string[] = [];
    const run = await runSurvey({ config, name: "baseline", cwd: root, events: (event) => { events.push(event.type); } });
    expect(run).toMatchObject({ schema: "lantern-survey-run", version: 1, name: "baseline", status: "completed" });
    expect(run.targeting.componentIds).toEqual(["Button.tsx#Button"]);
    expect(run.config).not.toHaveProperty("output");
    expect(events[0]).toBe("survey-started");
    expect(events.at(-1)).toBe("survey-completed");
    rmSync(join(root, "Button.tsx"));
    expect(renderSurveyRun(run, { mode: "compact", color: false })).toContain("Lantern survey");
  });

  it("distinguishes pre-run cancellation from a cancelled started run", async () => {
    const root = mkdtempSync(join(tmpdir(), "lantern-rfc010-cancel-")); roots.push(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, engines: { static: false, rendered: false, axe: false, lighthouse: false } }));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const config = loadConfig({ cwd: root });
    const before = new AbortController(); before.abort();
    await expect(runSurvey({ config, signal: before.signal })).rejects.toMatchObject({ name: "SurveyCancelledError" });
    const during = new AbortController();
    const run = await runSurvey({ config, signal: during.signal, events: (event) => { if (event.type === "survey-started") during.abort(); } });
    expect(run.status).toBe("cancelled");
    expect(run.diagnostics.at(-1)?.code).toBe("SURVEY_CANCELLED");
  });
});
