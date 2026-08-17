import { describe, expect, it } from "vitest";
import type { GeneratedState } from "../state-planning/types.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import { planChecksForComponent } from "./plan-checks.js";

function component(): CanonicalComponent {
  return {
    id: "Button.tsx#Button",
    source: "Button.tsx",
    exportName: "Button",
    name: "Button",
    exportKind: "named",
    props: [],
    rendering: { intrinsicElements: ["button"], analyzable: true },
    analysis: { status: "complete", diagnostics: [] },
  };
}

function accessibility(overrides: Partial<AccessibilityComponent> = {}): AccessibilityComponent {
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
    ...overrides,
  };
}

function states(): GeneratedState[] {
  return [
    { id: "Button.tsx#Button#a", component: "Button", componentId: "Button.tsx#Button", props: {} },
    { id: "Button.tsx#Button#b", component: "Button", componentId: "Button.tsx#Button", props: { disabled: true } },
  ];
}

describe("planChecksForComponent", () => {
  it("plans one check per state for each active, applicable rule", () => {
    const checks = planChecksForComponent({
      component: component(),
      accessibility: accessibility(),
      states: states(),
      activeRules: new Map([["lantern/accessible-name", "error"]]),
    });

    expect(checks).toHaveLength(2);
    expect(checks.every((check) => check.ruleId === "lantern/accessible-name")).toBe(true);
    expect(checks.map((check) => check.stateId)).toEqual(["Button.tsx#Button#a", "Button.tsx#Button#b"]);
  });

  it("plans nothing for a rule that is not configured", () => {
    const checks = planChecksForComponent({
      component: component(),
      accessibility: accessibility(),
      states: states(),
      activeRules: new Map(),
    });

    expect(checks).toEqual([]);
  });

  it("skips a focus-gated rule for a non-focusable component without planning a check", () => {
    const checks = planChecksForComponent({
      component: component(),
      accessibility: accessibility({ interactivity: { focusable: false, handlers: [] } }),
      states: states(),
      activeRules: new Map([
        ["lantern/accessible-name", "error"],
        ["lantern/keyboard-access", "error"],
      ]),
    });

    expect(checks).toEqual([]);
  });

  it("is deterministic and independent of any concrete engine", () => {
    const input = {
      component: component(),
      accessibility: accessibility(),
      states: states(),
      activeRules: new Map<string, "error" | "warn">([
        ["lantern/accessible-name", "error"],
        ["lantern/keyboard-access", "warn"],
      ]),
    };

    const first = planChecksForComponent(input);
    const second = planChecksForComponent(input);

    expect(first).toEqual(second);
    expect(first.map((check) => `${check.ruleId}:${check.requiredCapability}`)).toEqual([
      "lantern/accessible-name:static-evidence",
      "lantern/accessible-name:static-evidence",
      "lantern/keyboard-access:rendered-dom",
      "lantern/keyboard-access:rendered-dom",
    ]);
  });
});
