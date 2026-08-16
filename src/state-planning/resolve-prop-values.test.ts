import { describe, expect, it } from "vitest";
import type { ComponentConfig } from "../schemas/components.js";
import type { FixturesConfig } from "../schemas/fixtures.js";
import type { AccessibilityComponent, ResolvedComponentProp } from "../types/component-scan.js";
import { resolvePropValues, type PropResolutionContext } from "./resolve-prop-values.js";

function prop(overrides: Partial<ResolvedComponentProp> = {}): ResolvedComponentProp {
  return {
    name: "disabled",
    type: "boolean | undefined",
    required: false,
    origin: "inherited",
    provenance: "react",
    ...overrides,
  };
}

const emptyAccessibility: AccessibilityComponent = {
  id: "Button.tsx#Button",
  name: "Button",
  source: "Button.tsx",
  semantics: { nativeElements: [], derived: false },
  interactivity: { focusable: false, handlers: [] },
  accessibleNameSources: [],
  ariaProps: [],
  stateProps: [],
  runtimeAnalysisRequired: false,
};

function context(overrides: {
  componentConfig?: ComponentConfig;
  fixtures?: FixturesConfig;
  accessibility?: AccessibilityComponent;
} = {}): PropResolutionContext {
  return {
    componentConfig: overrides.componentConfig,
    fixtures: overrides.fixtures ?? {},
    accessibility: overrides.accessibility ?? emptyAccessibility,
  };
}

describe("resolvePropValues", () => {
  it("infers a boolean for an accessibility-relevant optional prop", () => {
    const resolution = resolvePropValues(
      prop({ name: "disabled" }),
      context({ accessibility: { ...emptyAccessibility, stateProps: ["disabled"] } }),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "disabled", required: false, source: "inferred", values: [false, true] },
    });
  });

  it("infers a literal union for a component-owned optional prop even if not accessibility-tagged", () => {
    const resolution = resolvePropValues(
      prop({ name: "variant", type: '"default" | "outline"', origin: "declared" }),
      context(),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "variant", required: false, source: "inferred", values: ["default", "outline"] },
    });
  });

  it("omits an inherited, non-accessibility-relevant optional prop instead of inferring it", () => {
    const resolution = resolvePropValues(
      prop({ name: "tabIndex", type: "number | undefined", origin: "inherited" }),
      context(),
    );

    expect(resolution).toEqual({ status: "omitted" });
  });

  it("does not infer an open-ended optional prop even when it is accessibility-relevant", () => {
    const resolution = resolvePropValues(
      prop({ name: "title", type: "string | undefined", origin: "inherited" }),
      context({ accessibility: { ...emptyAccessibility, accessibleNameSources: ["title"] } }),
    );

    expect(resolution).toEqual({ status: "omitted" });
  });

  it("reports an unresolved required prop with an open-ended/domain type", () => {
    const resolution = resolvePropValues(
      prop({ name: "user", type: "User", required: true, origin: "declared" }),
      context(),
    );

    expect(resolution.status).toBe("unresolved");
    if (resolution.status === "unresolved") {
      expect(resolution.reason).toContain("user");
      expect(resolution.reason).toContain("User");
    }
  });

  it("prefers explicit configured values over inference", () => {
    const resolution = resolvePropValues(
      prop({ name: "variant", type: '"default" | "outline" | "destructive"', origin: "declared" }),
      context({ componentConfig: { props: { variant: { values: ["destructive"] } } } }),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "variant", required: false, source: "explicit", values: ["destructive"] },
    });
  });

  it("resolves explicit values even for an otherwise non-inferable open-ended prop", () => {
    const resolution = resolvePropValues(
      prop({ name: "children", type: "ReactNode", origin: "declared" }),
      context({ componentConfig: { props: { children: { values: ["Save", "Delete"] } } } }),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "children", required: false, source: "explicit", values: ["Save", "Delete"] },
    });
  });

  it("resolves a configured fixture reference", () => {
    const resolution = resolvePropValues(
      prop({ name: "user", type: "User", required: true, origin: "declared" }),
      context({
        componentConfig: { props: { user: { fixture: "users" } } },
        fixtures: { users: ["guest", "admin"] },
      }),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "user", required: true, source: "fixture", values: ["guest", "admin"] },
    });
  });

  it("reports an unresolved required prop when the referenced fixture does not exist", () => {
    const resolution = resolvePropValues(
      prop({ name: "user", type: "User", required: true, origin: "declared" }),
      context({ componentConfig: { props: { user: { fixture: "missing" } } } }),
    );

    expect(resolution.status).toBe("unresolved");
    if (resolution.status === "unresolved") {
      expect(resolution.reason).toContain("missing");
    }
  });

  it("reports an unresolved required prop when explicit values are empty", () => {
    const resolution = resolvePropValues(
      prop({ name: "user", type: "User", required: true, origin: "declared" }),
      context({ componentConfig: { props: { user: { values: [] } } } }),
    );

    expect(resolution.status).toBe("unresolved");
  });

  it("attempts inference for a required prop even if it is inherited and not accessibility-tagged", () => {
    const resolution = resolvePropValues(
      prop({ name: "kind", type: '"a" | "b"', required: true, origin: "inherited" }),
      context(),
    );

    expect(resolution).toEqual({
      status: "resolved",
      plan: { name: "kind", required: true, source: "inferred", values: ["a", "b"] },
    });
  });
});
