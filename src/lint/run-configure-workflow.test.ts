import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UnresolvedProp } from "../state-planning/types.js";
import type { ConfigurePrompter, PromptedAction } from "./run-configure-workflow.js";
import { runConfigureWorkflow } from "./run-configure-workflow.js";
import type { ComponentReport, LintReport } from "./types.js";

function unresolvedComponent(component: string, propName: string): ComponentReport {
  return {
    componentId: `${component}.tsx#${component}`,
    component,
    source: `${component}.tsx`,
    planStatus: "unresolved",
    status: "skipped",
    states: [],
    unresolvedProps: [{ name: propName, type: "User", reason: "no value" }],
    truncated: false,
    totalPossibleStates: 0,
    maxStates: 50,
  };
}

function report(components: readonly ComponentReport[]): LintReport {
  return {
    version: 3,
    runId: "run-1",
    startedAt: new Date(0).toISOString(),
    finishedAt: new Date(0).toISOString(),
    status: "completed",
    generatedAt: new Date(0).toISOString(),
    targeting: { mode: { kind: "incremental" }, rescanned: true },
    engines: [],
    config: { standards: ["wcag22-aa"], rules: {} },
    standards: [{ standard: "wcag22-aa", components }],
    summary: {
      componentsPass: 0,
      componentsFail: 0,
      componentsReview: 0,
      componentsSkipped: components.length,
      checksPass: 0,
      checksFail: 0,
      checksReview: 0,
      durationMs: 0,
    },
  };
}

class ScriptedPrompter implements ConfigurePrompter {
  readonly notifications: string[] = [];

  constructor(
    private readonly actions: readonly PromptedAction[],
    private readonly values: readonly unknown[] = ["guest"],
    private readonly fixtureName = "users",
    private readonly fixtureValues: readonly unknown[] | undefined = ["guest", "admin"],
  ) {}

  private index = 0;

  selectAction(): Promise<PromptedAction> {
    const action = this.actions[this.index];
    this.index += 1;
    return Promise.resolve(action ?? "leave-unresolved");
  }

  promptValues(): Promise<readonly unknown[]> {
    return Promise.resolve(this.values);
  }

  promptFixtureName(): Promise<string> {
    return Promise.resolve(this.fixtureName);
  }

  promptFixtureValues(): Promise<readonly unknown[] | undefined> {
    return Promise.resolve(this.fixtureValues);
  }

  notify(message: string): void {
    this.notifications.push(message);
  }
}

describe("runConfigureWorkflow", () => {
  let dir: string;
  let configFilePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lantern-configure-workflow-"));
    configFilePath = join(dir, "lantern.config.json");
    writeFileSync(configFilePath, JSON.stringify({ project: {} }));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("notifies and does nothing when there is nothing unresolved", async () => {
    const prompter = new ScriptedPrompter([]);

    const result = await runConfigureWorkflow({ configFilePath, report: report([]), prompter });

    expect(result).toEqual({ promptedComponents: 0, resolvedCount: 0 });
    expect(prompter.notifications[0]).toContain("nothing to configure");
  });

  it("writes explicit values chosen by the prompter", async () => {
    const prompter = new ScriptedPrompter(["values"], ["guest", "admin"]);

    const result = await runConfigureWorkflow({
      configFilePath,
      report: report([unresolvedComponent("Avatar", "user")]),
      prompter,
    });

    expect(result).toEqual({ promptedComponents: 1, resolvedCount: 1 });
    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({ Avatar: { props: { user: { values: ["guest", "admin"] } } } });
  });

  it("writes a fixture reference and creates the fixture when the prompter supplies values", async () => {
    const prompter = new ScriptedPrompter(["fixture"]);

    await runConfigureWorkflow({
      configFilePath,
      report: report([unresolvedComponent("Avatar", "user")]),
      prompter,
    });

    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown; fixtures: unknown };
    expect(onDisk.components).toEqual({ Avatar: { props: { user: { fixture: "users" } } } });
    expect(onDisk.fixtures).toEqual({ users: ["guest", "admin"] });
  });

  it("writes a placeholder without resolving the prop", async () => {
    const prompter = new ScriptedPrompter(["placeholder"]);

    await runConfigureWorkflow({
      configFilePath,
      report: report([unresolvedComponent("Avatar", "user")]),
      prompter,
    });

    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({ Avatar: { props: { user: {} } } });
  });

  it("skips the component and stops asking about its remaining unresolved props", async () => {
    const twoProps: ComponentReport = {
      ...unresolvedComponent("Avatar", "user"),
      unresolvedProps: [
        { name: "user", type: "User", reason: "no value" } satisfies UnresolvedProp,
        { name: "icon", type: "Icon", reason: "no value" } satisfies UnresolvedProp,
      ],
    };
    const prompter = new ScriptedPrompter(["skip-component"]);

    const result = await runConfigureWorkflow({ configFilePath, report: report([twoProps]), prompter });

    expect(result.resolvedCount).toBe(1);
    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components: unknown };
    expect(onDisk.components).toEqual({ Avatar: { skip: true } });
  });

  it("leaves the prop unresolved and writes nothing when the user declines to act", async () => {
    const prompter = new ScriptedPrompter(["leave-unresolved"]);

    const result = await runConfigureWorkflow({
      configFilePath,
      report: report([unresolvedComponent("Avatar", "user")]),
      prompter,
    });

    expect(result).toEqual({ promptedComponents: 1, resolvedCount: 0 });
    const onDisk = JSON.parse(readFileSync(configFilePath, "utf-8")) as { components?: unknown };
    expect(onDisk.components).toBeUndefined();
  });

  it("deduplicates the same component across multiple standards before prompting", async () => {
    const component = unresolvedComponent("Avatar", "user");
    const prompter = new ScriptedPrompter(["values"], ["guest"]);

    const result = await runConfigureWorkflow({
      configFilePath,
      report: {
        version: 3,
        runId: "run-2",
        startedAt: new Date(0).toISOString(),
        finishedAt: new Date(0).toISOString(),
        status: "completed",
        generatedAt: new Date(0).toISOString(),
        targeting: { mode: { kind: "incremental" }, rescanned: true },
        engines: [],
        config: { standards: ["wcag22-aa", "rgaa4.1"], rules: {} },
        standards: [
          { standard: "wcag22-aa", components: [component] },
          { standard: "rgaa4.1", components: [component] },
        ],
        summary: {
          componentsPass: 0,
          componentsFail: 0,
          componentsReview: 0,
          componentsSkipped: 1,
          checksPass: 0,
          checksFail: 0,
          checksReview: 0,
          durationMs: 0,
        },
      },
      prompter,
    });

    expect(result.promptedComponents).toBe(1);
  });
});
