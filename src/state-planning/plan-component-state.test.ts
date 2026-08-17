import { describe, expect, it } from "vitest";
import type { ComponentConfig } from "../schemas/components.js";
import type { FixturesConfig } from "../schemas/fixtures.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import { DEFAULT_MAX_STATES, planComponentState } from "./plan-component-state.js";

const buttonComponent: CanonicalComponent = {
  id: "Button.tsx#Button",
  source: "Button.tsx",
  exportName: "Button",
  name: "Button",
  exportKind: "named",
  props: [
    { name: "disabled", type: "boolean | undefined", required: false, origin: "external-inherited", provenance: "react" },
    { name: "onClick", type: "() => void", required: false, origin: "external-inherited", provenance: "react" },
    {
      name: "size",
      type: '"sm" | "md" | "lg" | null',
      required: false,
      origin: "component",
      provenance: "Button.tsx",
    },
    { name: "tabIndex", type: "number | undefined", required: false, origin: "external-inherited", provenance: "react" },
    {
      name: "variant",
      type: '"default" | "outline" | "destructive"',
      required: true,
      origin: "component",
      provenance: "Button.tsx",
    },
  ],
  rendering: { intrinsicElements: ["button"], analyzable: true },
  analysis: { status: "complete", diagnostics: [] },
};

const buttonAccessibility: AccessibilityComponent = {
  id: "Button.tsx#Button",
  name: "Button",
  source: "Button.tsx",
  semantics: { nativeElements: ["button"], derived: true },
  interactivity: { focusable: true, handlers: ["onClick"] },
  accessibleNameSources: [],
  ariaProps: [],
  stateProps: ["disabled"],
  runtimeAnalysisRequired: false,
};

const avatarComponent: CanonicalComponent = {
  id: "Avatar.tsx#Avatar",
  source: "Avatar.tsx",
  exportName: "Avatar",
  name: "Avatar",
  exportKind: "named",
  props: [{ name: "user", type: "User", required: true, origin: "component", provenance: "Avatar.tsx" }],
  rendering: { intrinsicElements: ["img"], analyzable: true },
  analysis: { status: "complete", diagnostics: [] },
};

const avatarAccessibility: AccessibilityComponent = {
  id: "Avatar.tsx#Avatar",
  name: "Avatar",
  source: "Avatar.tsx",
  semantics: { nativeElements: ["img"], derived: true },
  interactivity: { focusable: false, handlers: [] },
  accessibleNameSources: [],
  ariaProps: [],
  stateProps: [],
  runtimeAnalysisRequired: false,
};

describe("planComponentState", () => {
  it("generates deterministic combinations from accessibility-relevant and component-owned dimensions only", () => {
    const plan = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      return;
    }
    expect(plan.dimensions.map((dimension) => dimension.name)).toEqual(["size", "variant"]);
    expect(plan.totalPossibleStates).toBe(4 * 3);
    expect(plan.truncated).toBe(false);
    expect(plan.states).toHaveLength(12);
    // Inherited, non-accessibility-relevant and handler props never become dimensions.
    for (const state of plan.states) {
      expect(state.props).not.toHaveProperty("tabIndex");
      expect(state.props).not.toHaveProperty("onClick");
    }
    // Includes the nullable literal member.
    expect(plan.states.some((state) => state.props["size"] === null)).toBe(true);
  });

  it("produces the same combination order across repeated calls (deterministic)", () => {
    const first = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });
    const second = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });

    expect(first).toEqual(second);
  });

  it("produces stable, unique state ids", () => {
    const plan = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });
    if (plan.status !== "ready") {
      throw new Error("expected a ready plan");
    }

    const ids = plan.states.map((state) => state.id);
    expect(new Set(ids).size).toBe(ids.length);

    const replan = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });
    if (replan.status !== "ready") {
      throw new Error("expected a ready plan");
    }
    expect(replan.states.map((state) => state.id)).toEqual(ids);
  });

  it("bounds generation at maxStates and reports truncation", () => {
    const plan = planComponentState({
      component: buttonComponent,
      accessibility: buttonAccessibility,
      maxStates: 5,
    });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      return;
    }
    expect(plan.states).toHaveLength(5);
    expect(plan.totalPossibleStates).toBe(12);
    expect(plan.truncated).toBe(true);
    expect(plan.maxStates).toBe(5);
  });

  it("uses the default max-states bound when none is provided", () => {
    const plan = planComponentState({ component: buttonComponent, accessibility: buttonAccessibility });

    expect(plan.status).toBe("ready");
    if (plan.status === "ready") {
      expect(plan.maxStates).toBe(DEFAULT_MAX_STATES);
    }
  });

  it("lets explicit configured values override inference and collapse a dimension to a fixed value", () => {
    const componentConfig: ComponentConfig = { props: { variant: { values: ["destructive"] } } };

    const plan = planComponentState({
      component: buttonComponent,
      accessibility: buttonAccessibility,
      componentConfig,
    });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      return;
    }
    // variant is now fixed (one explicit value), so only disabled x size branch.
    expect(plan.totalPossibleStates).toBe(4);
    expect(plan.states.every((state) => state.props["variant"] === "destructive")).toBe(true);
  });

  it("reports an unresolved required prop instead of inventing a value", () => {
    const plan = planComponentState({ component: avatarComponent, accessibility: avatarAccessibility });

    expect(plan.status).toBe("unresolved");
    if (plan.status !== "unresolved") {
      return;
    }
    expect(plan.component).toBe("Avatar");
    expect(plan.componentId).toBe("Avatar.tsx#Avatar");
    expect(plan.unresolvedProps).toHaveLength(1);
    expect(plan.unresolvedProps[0]?.name).toBe("user");
    expect(plan.unresolvedProps[0]?.type).toBe("User");
    expect(plan.unresolvedProps[0]?.reason).toContain("user");
  });

  it("resolves an otherwise-unresolvable required prop through a configured fixture", () => {
    const componentConfig: ComponentConfig = { props: { user: { fixture: "users" } } };
    const fixtures: FixturesConfig = { users: ["guest", "admin"] };

    const plan = planComponentState({
      component: avatarComponent,
      accessibility: avatarAccessibility,
      componentConfig,
      fixtures,
    });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      return;
    }
    expect(plan.states.map((state) => state.props["user"]).sort()).toEqual(["admin", "guest"]);
  });

  it("short-circuits to skipped when the component is explicitly skipped", () => {
    const componentConfig: ComponentConfig = { skip: true };

    const plan = planComponentState({
      component: avatarComponent,
      accessibility: avatarAccessibility,
      componentConfig,
    });

    expect(plan).toEqual({ status: "skipped", component: "Avatar", componentId: "Avatar.tsx#Avatar" });
  });

  it("generates a single default state for a component with no resolvable dimensions", () => {
    const noPropsComponent: CanonicalComponent = { ...buttonComponent, props: [] };

    const plan = planComponentState({ component: noPropsComponent, accessibility: buttonAccessibility });

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") {
      return;
    }
    expect(plan.states).toHaveLength(1);
    expect(plan.states[0]).toMatchObject({
      component: "Button",
      componentId: "Button.tsx#Button",
      props: {},
    });
    expect(typeof plan.states[0]?.id).toBe("string");
  });
});
