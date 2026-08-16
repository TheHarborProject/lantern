import { describe, expect, it } from "vitest";
import type { AccessibilityComponent } from "../types/component-scan.js";
import { isAccessibilityRelevantPropName } from "./is-accessibility-relevant-prop.js";

const accessibility: AccessibilityComponent = {
  id: "Button.tsx#Button",
  name: "Button",
  source: "Button.tsx",
  semantics: { nativeElements: ["button"], derived: true },
  interactivity: { focusable: true, handlers: ["onClick", "onKeyDown"] },
  accessibleNameSources: ["title", "children"],
  ariaProps: ["aria-label", "role"],
  stateProps: ["disabled", "expanded"],
  runtimeAnalysisRequired: false,
};

describe("isAccessibilityRelevantPropName", () => {
  it("matches a state prop", () => {
    expect(isAccessibilityRelevantPropName("disabled", accessibility)).toBe(true);
  });

  it("matches an aria prop", () => {
    expect(isAccessibilityRelevantPropName("aria-label", accessibility)).toBe(true);
  });

  it("matches an accessible-name source", () => {
    expect(isAccessibilityRelevantPropName("children", accessibility)).toBe(true);
  });

  it("does not match an interaction handler", () => {
    expect(isAccessibilityRelevantPropName("onClick", accessibility)).toBe(false);
  });

  it("does not match an unrelated prop", () => {
    expect(isAccessibilityRelevantPropName("tabIndex", accessibility)).toBe(false);
  });
});
