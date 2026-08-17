import { describe, expect, it } from "vitest";
import { computeExitCode } from "./compute-exit-code.js";
import type { ComponentReport, LintReport, StateReport } from "./types.js";

function state(overrides: Partial<StateReport> = {}): StateReport {
  return {
    componentId: "Button.tsx#Button",
    stateId: "Button.tsx#Button#abc",
    props: {},
    propProvenance: {},
    checks: [],
    status: "review",
    ...overrides,
  };
}

function component(overrides: Partial<ComponentReport> = {}): ComponentReport {
  return {
    componentId: "Button.tsx#Button",
    component: "Button",
    source: "Button.tsx",
    planStatus: "ready",
    status: "review",
    states: [],
    truncated: false,
    totalPossibleStates: 1,
    maxStates: 50,
    ...overrides,
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
      componentsSkipped: 0,
      checksPass: 0,
      checksFail: 0,
      checksReview: 0,
      durationMs: 0,
    },
  };
}

describe("computeExitCode", () => {
  it("returns 0 when there is nothing but review states", () => {
    const result = computeExitCode(report([component({ states: [state()] })]), { failOnSkipped: false });

    expect(result).toBe(0);
  });

  it("returns 1 for a failed check with severity error", () => {
    const failing = component({
      states: [
        state({
          checks: [{ checkId: "check-1", componentId: "Button.tsx#Button", stateId: "Button.tsx#Button#abc", ruleId: "lantern/color-contrast", severity: "error", status: "fail", evidence: [], durationMs: 0 }],
          status: "fail",
        }),
      ],
      status: "fail",
    });

    expect(computeExitCode(report([failing]), { failOnSkipped: false })).toBe(1);
  });

  it("returns 0 for a failed check with severity warn alone", () => {
    const warning = component({
      states: [
        state({
          checks: [{ checkId: "check-2", componentId: "Button.tsx#Button", stateId: "Button.tsx#Button#abc", ruleId: "lantern/focus-visible", severity: "warn", status: "fail", evidence: [], durationMs: 0 }],
          status: "fail",
        }),
      ],
      status: "fail",
    });

    expect(computeExitCode(report([warning]), { failOnSkipped: false })).toBe(0);
  });

  it("returns 0 for skipped/unresolved components by default", () => {
    const skipped = component({ planStatus: "skipped", status: "skipped" });

    expect(computeExitCode(report([skipped]), { failOnSkipped: false })).toBe(0);
  });

  it("returns 1 for skipped/unresolved components with --fail-on-skipped", () => {
    const skipped = component({ planStatus: "skipped", status: "skipped" });

    expect(computeExitCode(report([skipped]), { failOnSkipped: true })).toBe(1);
  });

  it("does not let --fail-on-skipped affect ready/review components", () => {
    const ready = component({ states: [state()] });

    expect(computeExitCode(report([ready]), { failOnSkipped: true })).toBe(0);
  });
});
