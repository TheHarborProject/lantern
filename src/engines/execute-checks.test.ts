import { describe, expect, it } from "vitest";
import type { CheckResult } from "../lint/types.js";
import type { AccessibilityComponent } from "../types/component-scan.js";
import { executePlannedChecks } from "./execute-checks.js";
import type { Engine, PlannedCheck } from "./types.js";

function accessibility(): AccessibilityComponent {
  return {
    id: "Button.tsx#Button",
    name: "Button",
    source: "Button.tsx",
    semantics: { nativeElements: ["button"], derived: true },
    interactivity: { focusable: true, handlers: [] },
    accessibleNameSources: [],
    ariaProps: [],
    stateProps: [],
    runtimeAnalysisRequired: false,
  };
}

function check(ruleId: string, stateId: string): PlannedCheck {
  return {
    checkId: `${stateId}:${ruleId}`,
    ruleId,
    severity: "error",
    componentId: "Button.tsx#Button",
    component: "Button",
    source: "Button.tsx",
    requiredCapability: "static-evidence",
    stateId,
    accessibility: accessibility(),
  };
}

describe("executePlannedChecks", () => {
  it("normalizes a check with no matching engine to a truthful review, never a silent pass", async () => {
    const executed = await executePlannedChecks([check("lantern/color-contrast", "s1")], [], () => ({}));

    expect(executed).toHaveLength(1);
    expect(executed[0]?.result.status).toBe("review");
    expect(executed[0]?.result.reason).toBeDefined();
  });

  it("executes checks in planned order, deterministically", async () => {
    const order: string[] = [];
    const engine: Engine = {
      identity: { id: "test-engine", version: "1.0.0" },
      capabilities: ["static-evidence"],
      supports: () => ({ kind: "supported" }),
      execute: (plannedCheck) => {
        order.push(plannedCheck.stateId ?? "");
        const result: CheckResult = { checkId: plannedCheck.checkId, componentId: plannedCheck.componentId, stateId: plannedCheck.stateId, ruleId: plannedCheck.ruleId, severity: plannedCheck.severity, status: "pass", evidence: [], durationMs: 0 };
        return Promise.resolve(result);
      },
    };

    const checks = [check("lantern/accessible-name", "s1"), check("lantern/accessible-name", "s2")];
    await executePlannedChecks(checks, [engine], () => ({}));

    expect(order).toEqual(["s1", "s2"]);
  });

  it("lets a genuine engine execution failure propagate instead of fabricating a result", async () => {
    const engine: Engine = {
      identity: { id: "flaky-engine", version: "1.0.0" },
      capabilities: ["static-evidence"],
      supports: () => ({ kind: "supported" }),
      execute: () => Promise.reject(new Error("engine crashed")),
    };

    await expect(executePlannedChecks([check("lantern/accessible-name", "s1")], [engine], () => ({}))).rejects.toThrow(
      "engine crashed",
    );
  });
});
