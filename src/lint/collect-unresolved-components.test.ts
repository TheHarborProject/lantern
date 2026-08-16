import { describe, expect, it } from "vitest";
import { collectUnresolvedComponents } from "./collect-unresolved-components.js";
import type { ComponentReport, LintReport } from "./types.js";

function unresolvedComponent(overrides: Partial<ComponentReport> = {}): ComponentReport {
  return {
    componentId: "Avatar.tsx#Avatar",
    component: "Avatar",
    source: "Avatar.tsx",
    planStatus: "unresolved",
    status: "skipped",
    states: [],
    unresolvedProps: [{ name: "user", type: "User", reason: "no value" }],
    truncated: false,
    totalPossibleStates: 0,
    maxStates: 50,
    ...overrides,
  };
}

function report(standards: LintReport["standards"]): LintReport {
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    targeting: { mode: { kind: "incremental" }, rescanned: true },
    standards,
    summary: {
      componentsPass: 0,
      componentsFail: 0,
      componentsReview: 0,
      componentsSkipped: standards[0]?.components.length ?? 0,
      checksPass: 0,
      checksFail: 0,
      checksReview: 0,
      durationMs: 0,
    },
  };
}

describe("collectUnresolvedComponents", () => {
  it("collects an unresolved component with its unresolved props", () => {
    const result = collectUnresolvedComponents(
      report([{ standard: "wcag22-aa", components: [unresolvedComponent()] }]),
    );

    expect(result).toEqual([{ component: "Avatar", unresolvedProps: [{ name: "user", type: "User", reason: "no value" }] }]);
  });

  it("ignores ready and skipped components", () => {
    const ready: ComponentReport = {
      componentId: "Button.tsx#Button",
      component: "Button",
      source: "Button.tsx",
      planStatus: "ready",
      status: "review",
      states: [],
      truncated: false,
      totalPossibleStates: 1,
      maxStates: 50,
    };
    const skipped: ComponentReport = {
      componentId: "Chip.tsx#Chip",
      component: "Chip",
      source: "Chip.tsx",
      planStatus: "skipped",
      status: "skipped",
      states: [],
      truncated: false,
      totalPossibleStates: 0,
      maxStates: 50,
    };

    const result = collectUnresolvedComponents(report([{ standard: "wcag22-aa", components: [ready, skipped] }]));

    expect(result).toEqual([]);
  });

  it("deduplicates the same unresolved component across multiple standards", () => {
    const result = collectUnresolvedComponents(
      report([
        { standard: "wcag22-aa", components: [unresolvedComponent()] },
        { standard: "rgaa4.1", components: [unresolvedComponent()] },
      ]),
    );

    expect(result).toHaveLength(1);
  });
});
