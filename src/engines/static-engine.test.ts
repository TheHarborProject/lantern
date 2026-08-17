import { describe, expect, it } from "vitest";
import type { AccessibilityComponent } from "../types/component-scan.js";
import { createStaticEngine } from "./static-engine.js";
import type { PlannedCheck } from "./types.js";

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

describe("createStaticEngine", () => {
  it("identifies itself", () => {
    const engine = createStaticEngine();
    expect(engine.identity).toEqual({ id: "lantern-static", version: "1.0.0" });
    expect(engine.capabilities).toEqual(["static-evidence"]);
  });

  it("only supports lantern/accessible-name over static evidence", () => {
    const engine = createStaticEngine();

    expect(engine.supports(check()).kind).toBe("supported");
    expect(engine.supports(check({ ruleId: "lantern/color-contrast" })).kind).toBe("unsupported");
    expect(engine.supports(check({ requiredCapability: "rendered-dom" })).kind).toBe("unsupported");
  });

  it("fails a component with no accessible-name-capable prop at all", async () => {
    const engine = createStaticEngine();

    const result = await engine.execute(check({ accessibility: accessibility({ accessibleNameSources: [] }) }), {});

    expect(result.status).toBe("fail");
    expect(result.severity).toBe("error");
    expect(result.engine).toEqual({ name: "lantern-static", version: "1.0.0" });
    expect(result.message).toContain("no prop capable of providing an accessible name");
  });

  it("reports review, never a fabricated pass, when the capability exists but cannot be proven populated", async () => {
    const engine = createStaticEngine();

    const result = await engine.execute(
      check({ accessibility: accessibility({ accessibleNameSources: ["aria-label"] }) }),
      {},
    );

    expect(result.status).toBe("review");
    expect(result.outcomeReason).toBe("manual-review");
    expect(result.evidence).toContainEqual({ kind: "observation", name: "accessibleNameSources", value: ["aria-label"] });
    expect(result.reason).toBeDefined();
  });
});
