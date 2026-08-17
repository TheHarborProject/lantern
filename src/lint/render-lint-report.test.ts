import { describe, expect, it } from "vitest";
import { renderLintReport } from "./render-lint-report.js";
import type { ComponentReport, LintReport, StateReport } from "./types.js";

function state(overrides: Partial<StateReport> = {}): StateReport {
  return {
    stateId: "Button.tsx#Button#abc",
    props: {},
    propProvenance: {},
    checks: [],
    status: "review",
    ...overrides,
  };
}

function component(overrides: Partial<ComponentReport> = {}): ComponentReport {
  return {
    componentId: "Button.tsx#Button",
    component: "Button",
    source: "Button.tsx",
    planStatus: "ready",
    status: "review",
    states: [state()],
    dimensions: [],
    truncated: false,
    totalPossibleStates: 1,
    maxStates: 50,
    ...overrides,
  };
}

function report(overrides: Partial<LintReport> = {}): LintReport {
  return {
    version: 2,
    generatedAt: new Date(0).toISOString(),
    targeting: { mode: { kind: "incremental" }, rescanned: true, selection: { kind: "all" } },
    provider: { kind: "unavailable", reason: "no check provider configured" },
    diagnostics: [],
    standards: [{ standard: "wcag22-aa", components: [component()] }],
    summary: {
      componentsPass: 0,
      componentsFail: 0,
      componentsReview: 1,
      componentsSkipped: 0,
      checksPass: 0,
      checksFail: 0,
      checksReview: 0,
      durationMs: 1420,
    },
    ...overrides,
  };
}

describe("renderLintReport", () => {
  it("renders concise default output without individual states", () => {
    const output = renderLintReport(report({
      standards: [{
        standard: "wcag22-aa",
        components: [
          component({
            states: [
              state({ props: { disabled: false, variant: "default" } }),
              state({ props: { disabled: true, variant: "outline" } }),
            ],
            dimensions: [{ name: "variant", values: ["default", "outline"], source: "inferred" }],
            totalPossibleStates: 2,
          }),
        ],
      }],
    }), { verbose: false });

    expect(output).toContain("Lantern lint");
    expect(output).toContain("Standard   WCAG 2.2 AA");
    expect(output).toContain("Provider   unavailable\n           no check provider configured");
    expect(output).toContain("◌ Button");
    expect(output).toContain("2 states · exhaustive");
    expect(output).not.toContain("disabled=false");
    expect(output).not.toContain("false /");
  });

  it("renders singular, exhaustive, and coverage-bounded planning text", () => {
    const output = renderLintReport(report({
      standards: [{
        standard: "wcag22-aa",
        components: [
          component({ component: "App", states: [state()], totalPossibleStates: 1 }),
          component({ states: [state(), state()], totalPossibleStates: 12 }),
          component({ component: "BigButton", states: [state(), state()], totalPossibleStates: 96, truncated: true }),
        ],
      }],
      summary: { ...report().summary, componentsReview: 3 },
    }), { verbose: false });

    expect(output).toContain("◌ App\n  1 state");
    expect(output).toContain("◌ Button\n  2 states · exhaustive");
    expect(output).toContain("◌ BigButton\n  96 states planned\n  2 selected · coverage-bounded");
  });

  it("shows dimensions and named selected states in verbose output", () => {
    const output = renderLintReport(report({
      standards: [{
        standard: "wcag22-aa",
        components: [
          component({
            states: [
              state({ props: { disabled: false, size: "default", variant: "outline" } }),
              state({ props: { disabled: true, size: "sm", variant: "default" } }),
            ],
            dimensions: [
              { name: "disabled", values: [false, true], source: "inferred" },
              { name: "size", values: ["default", "sm"], source: "inferred" },
              { name: "variant", values: ["default", "outline"], source: "inferred" },
            ],
            totalPossibleStates: 96,
            truncated: true,
          }),
        ],
      }],
    }), { verbose: true });

    expect(output).toContain("Standard   WCAG 2.2 AA (wcag22-aa)");
    expect(output).toContain("Dimensions");
    expect(output).toContain("disabled   false | true");
    expect(output).toContain("variant    default | outline");
    expect(output).toContain("Showing 2 selected states from 96 theoretical states");
    expect(output).toContain("Selection: coverage-bounded");
    expect(output).toContain("#1  disabled=false  size=default  variant=outline");
  });

  it("renders since targeting context from structured selection metadata", () => {
    const output = renderLintReport(report({
      targeting: {
        mode: { kind: "since", ref: "HEAD~1" },
        rescanned: true,
        selection: { kind: "fallback", reason: "shared source changed: src/lib/utils.ts" },
      },
    }), { verbose: false });

    expect(output).toContain("Target     changes since HEAD~1");
    expect(output).toContain("Selection  full component set");
    expect(output).toContain("Reason     shared source changed: src/lib/utils.ts");
  });

  it("renders explicit path target context", () => {
    const output = renderLintReport(report({
      targeting: {
        mode: { kind: "path", path: "src/components/ui" },
        rescanned: true,
        selection: { kind: "path", path: "src/components/ui", pathKind: "directory", componentCount: 2 },
      },
      summary: { ...report().summary, componentsReview: 2 },
    }), { verbose: false });

    expect(output).toContain("Target     src/components/ui");
    expect(output).toContain("Selection  2 components");
    expect(output).not.toContain("Type       directory");
  });

  it("renders explicit path target type in verbose mode and zero selection", () => {
    const output = renderLintReport(report({
      targeting: {
        mode: { kind: "path", path: "src/lib" },
        rescanned: true,
        selection: { kind: "path", path: "src/lib", pathKind: "directory", componentCount: 0 },
      },
      standards: [{ standard: "wcag22-aa", components: [] }],
      summary: { ...report().summary, componentsReview: 0 },
    }), { verbose: true });

    expect(output).toContain("Target     src/lib");
    expect(output).toContain("Type       directory");
    expect(output).toContain("Selection  no components");
  });

  it("renders no affected components for since no-op selection", () => {
    const output = renderLintReport(report({
      targeting: {
        mode: { kind: "since", ref: "HEAD~1" },
        rescanned: true,
        selection: { kind: "none" },
      },
      standards: [{ standard: "wcag22-aa", components: [] }],
      summary: { ...report().summary, componentsReview: 0 },
    }), { verbose: false });

    expect(output).toContain("Selection  no affected components");
  });

  it("keeps diagnostics visible", () => {
    const output = renderLintReport(report({
      diagnostics: [{ source: "src/Foo.tsx", component: "Foo", message: "Component analysis is incomplete." }],
    }), { verbose: false });

    expect(output).toContain("Review");
    expect(output).toContain("! src/Foo.tsx#Foo");
    expect(output).toContain("Component analysis is incomplete.");
  });

  it("renders compact deterministic summary", () => {
    const output = renderLintReport(report(), { verbose: false });

    expect(output).toContain("Summary\n1 component · 0 passed · 0 failed · 1 review · 0 skipped\n1.42s");
  });

  it("falls back to unknown standard identifiers", () => {
    const output = renderLintReport(report({ standards: [{ standard: "future-standard", components: [component()] }] }), {
      verbose: false,
    });

    expect(output).toContain("Standard   future-standard");
  });
});
