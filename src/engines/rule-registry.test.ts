import { describe, expect, it } from "vitest";
import { KNOWN_STANDARDS } from "../schemas/standards.js";
import type { GeneratedState } from "../state-planning/types.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import { LANTERN_RULES, ruleStandardsIndex } from "./rule-registry.js";

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

const oneState: GeneratedState[] = [
  { id: "Button.tsx#Button#a", component: "Button", componentId: "Button.tsx#Button", props: {} },
];

describe("LANTERN_RULES", () => {
  it("covers the lantern:recommended preset catalog", () => {
    expect(LANTERN_RULES.map((rule) => rule.ruleId).sort()).toEqual(
      ["lantern/accessible-name", "lantern/color-contrast", "lantern/focus-visible", "lantern/keyboard-access"].sort(),
    );
  });

  it("maps every known rule to at least one configured standard", () => {
    for (const rule of LANTERN_RULES) {
      expect(rule.standards.length).toBeGreaterThan(0);
    }
  });

  it("gates focus-dependent rules on the component actually being focusable", () => {
    const notFocusable = accessibility({ interactivity: { focusable: false, handlers: [] } });

    for (const ruleId of ["lantern/accessible-name", "lantern/keyboard-access", "lantern/focus-visible"]) {
      const rule = LANTERN_RULES.find((candidate) => candidate.ruleId === ruleId);
      expect(rule?.plan({ component: component(), accessibility: notFocusable, states: oneState, severity: "error" })).toEqual([]);
    }
  });

  it("plans lantern/color-contrast regardless of focusability", () => {
    const rule = LANTERN_RULES.find((candidate) => candidate.ruleId === "lantern/color-contrast");
    const notFocusable = accessibility({ interactivity: { focusable: false, handlers: [] } });

    expect(
      rule?.plan({ component: component(), accessibility: notFocusable, states: oneState, severity: "warn" }),
    ).toHaveLength(1);
  });
});

describe("ruleStandardsIndex", () => {
  it("indexes every known rule against its declared standards", () => {
    const index = ruleStandardsIndex();

    for (const rule of LANTERN_RULES) {
      expect([...(index.get(rule.ruleId) ?? [])].sort()).toEqual([...rule.standards].sort());
    }
  });

  it("keeps configured standards distinct: nothing maps to an unconfigured/unknown standard", () => {
    const index = ruleStandardsIndex();

    for (const standards of index.values()) {
      for (const standard of standards) {
        expect(KNOWN_STANDARDS).toContain(standard);
      }
    }
  });
});
