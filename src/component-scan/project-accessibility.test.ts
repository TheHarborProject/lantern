import { describe, expect, it } from "vitest";
import type { CanonicalComponentModel, ResolvedComponentProp } from "../types/component-scan.js";
import { projectAccessibility } from "./project-accessibility.js";

function prop(name: string): ResolvedComponentProp {
  return { name, type: "unknown", required: false, origin: "external-inherited", provenance: "lib" };
}

function model(components: CanonicalComponentModel["components"]): CanonicalComponentModel {
  return { version: 2, components, diagnostics: [] };
}

describe("projectAccessibility", () => {
  it("derives native semantics, focusability, and accessibility facts from the model", () => {
    const index = projectAccessibility(
      model([
        {
          id: "src/Button.tsx#Button",
          source: "src/Button.tsx",
          exportName: "Button",
          name: "Button",
          exportKind: "named",
          props: [
            prop("aria-label"),
            prop("aria-pressed"),
            prop("children"),
            prop("disabled"),
            prop("onClick"),
            prop("role"),
            prop("variant"),
          ],
          rendering: { intrinsicElements: ["button"], analyzable: true },
          analysis: { status: "complete", diagnostics: [] },
        },
      ]),
    );

    expect(index.components[0]).toEqual({
      id: "src/Button.tsx#Button",
      name: "Button",
      source: "src/Button.tsx",
      semantics: { nativeElements: ["button"], derived: true },
      interactivity: { focusable: true, handlers: ["onClick"] },
      accessibleNameSources: ["aria-label", "children"],
      ariaProps: ["aria-label", "aria-pressed", "role"],
      stateProps: ["disabled"],
      runtimeAnalysisRequired: false,
    });
  });

  it("flags runtime analysis when native semantics cannot be determined", () => {
    const index = projectAccessibility(
      model([
        {
          id: "src/Menu.tsx#Menu",
          source: "src/Menu.tsx",
          exportName: "Menu",
          name: "Menu",
          exportKind: "named",
          props: [prop("tabIndex")],
          rendering: { intrinsicElements: [], analyzable: false },
          analysis: { status: "complete", diagnostics: [] },
        },
      ]),
    );

    expect(index.components[0]?.semantics).toEqual({ nativeElements: [], derived: false });
    expect(index.components[0]?.interactivity.focusable).toBe(true);
    expect(index.components[0]?.runtimeAnalysisRequired).toBe(true);
  });

  it("flags runtime analysis when prop analysis was only partial", () => {
    const index = projectAccessibility(
      model([
        {
          id: "src/Field.tsx#Field",
          source: "src/Field.tsx",
          exportName: "Field",
          name: "Field",
          exportKind: "named",
          props: [],
          rendering: { intrinsicElements: ["input"], analyzable: true },
          analysis: { status: "partial", diagnostics: ["no annotation"] },
        },
      ]),
    );

    expect(index.components[0]?.runtimeAnalysisRequired).toBe(true);
  });
});
