import { describe, expect, it } from "vitest";
import type { AccessibilityComponent } from "../types/component-scan.js";
import { matchEngine } from "./match-engine.js";
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

function check(overrides: Partial<PlannedCheck> = {}): PlannedCheck {
  return {
    checkId: "check-1",
    ruleId: "lantern/accessible-name",
    severity: "error",
    componentId: "Button.tsx#Button",
    component: "Button",
    source: "Button.tsx",
    requiredCapability: "static-evidence",
    stateId: "state-1",
    accessibility: accessibility(),
    ...overrides,
  };
}

function stubEngine(id: string, support: Engine["supports"]): Engine {
  return {
    identity: { id, version: "1.0.0" },
    capabilities: ["static-evidence"],
    supports: support,
    execute: () => Promise.reject(new Error("not used in this test")),
  };
}

describe("matchEngine", () => {
  it("picks the first enabled engine, in declared order, that declares support", () => {
    const first = stubEngine("first", () => ({ kind: "unsupported", reason: "no" }));
    const second = stubEngine("second", () => ({ kind: "supported" }));

    const matched = matchEngine(check(), [first, second]);

    expect("engine" in matched && matched.engine.identity.id).toBe("second");
  });

  it("reports no engines enabled distinctly from no engine supporting the check", () => {
    const none = matchEngine(check(), []);
    expect("reason" in none && none.reason).toContain("No engines are enabled");

    const unsupported = matchEngine(check(), [stubEngine("only", () => ({ kind: "unsupported", reason: "nope" }))]);
    expect("reason" in unsupported && unsupported.reason).toContain('No enabled engine supports "lantern/accessible-name"');
    expect("reason" in unsupported && unsupported.reason).toContain("only: nope");
  });

  it("is deterministic for the same check and engine set", () => {
    const engines = [stubEngine("a", () => ({ kind: "unsupported", reason: "x" })), stubEngine("b", () => ({ kind: "supported" }))];

    expect(matchEngine(check(), engines)).toEqual(matchEngine(check(), engines));
  });
});
