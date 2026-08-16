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
    truncated: false,
    totalPossibleStates: 1,
    maxStates: 50,
    ...overrides,
  };
}

function report(overrides: Partial<LintReport> = {}): LintReport {
  return {
    version: 1,
    generatedAt: new Date(0).toISOString(),
    targeting: { mode: { kind: "incremental" }, rescanned: true },
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
  it("does not fabricate check lines when no checks were executed", () => {
    const output = renderLintReport(report(), { verbose: false });

    expect(output).toContain("no checks executed (no check provider configured)");
    expect(output).not.toMatch(/✓ has an accessible name/);
  });

  it("avoids unnecessary state nesting for a single-state component", () => {
    const output = renderLintReport(report(), { verbose: false });

    expect(output).not.toContain("default");
  });

  it("nests multiple states under the component", () => {
    const multiState = report({
      standards: [
        {
          standard: "wcag22-aa",
          components: [component({ states: [state({ props: { size: "sm" } }), state({ props: { size: "lg" } })] })],
        },
      ],
    });

    const output = renderLintReport(multiState, { verbose: false });

    expect(output).toContain('"sm"');
    expect(output).toContain('"lg"');
  });

  it("renders a skipped component with its reason", () => {
    const skipped = report({
      standards: [
        {
          standard: "wcag22-aa",
          components: [
            component({ planStatus: "skipped", status: "skipped", states: [], reason: "Explicitly skipped in configuration." }),
          ],
        },
      ],
    });

    const output = renderLintReport(skipped, { verbose: false });

    expect(output).toContain("⚠ Button");
    expect(output).toContain("↷ skipped — Explicitly skipped in configuration.");
  });

  it("renders an unresolved component with the unresolved reason", () => {
    const unresolved = report({
      standards: [
        {
          standard: "wcag22-aa",
          components: [
            component({
              component: "Avatar",
              planStatus: "unresolved",
              status: "skipped",
              states: [],
              unresolvedProps: [{ name: "user", type: "User", reason: "no value" }],
              reason: 'required prop "user" has no configured or inferred value',
            }),
          ],
        },
      ],
    });

    const output = renderLintReport(unresolved, { verbose: false });

    expect(output).toContain('required prop "user" has no configured or inferred value');
  });

  it("surfaces truncation as a visible, honest note", () => {
    const truncated = report({
      standards: [
        {
          standard: "wcag22-aa",
          components: [component({ states: [state(), state()], truncated: true, totalPossibleStates: 12, maxStates: 2 })],
        },
      ],
    });

    const output = renderLintReport(truncated, { verbose: false });

    expect(output).toContain("2/12 states shown (truncated at maxStates=2; not exhaustive)");
  });

  it("keeps multiple standards as separate visible sections", () => {
    const multiStandard = report({
      standards: [
        { standard: "wcag22-aa", components: [component()] },
        { standard: "rgaa4.1", components: [component()] },
      ],
    });

    const output = renderLintReport(multiStandard, { verbose: false });

    expect(output.indexOf("wcag22-aa")).toBeLessThan(output.indexOf("rgaa4.1"));
  });

  it("hides provenance and state id outside --verbose", () => {
    const output = renderLintReport(report(), { verbose: false });

    expect(output).not.toContain("Button.tsx#Button#abc");
  });

  it("exposes stable state id and prop provenance in --verbose", () => {
    const verboseReport = report({
      standards: [
        {
          standard: "wcag22-aa",
          components: [
            component({
              states: [state({ props: { disabled: true }, propProvenance: { disabled: "inferred" } })],
            }),
          ],
        },
      ],
    });

    const output = renderLintReport(verboseReport, { verbose: true });

    expect(output).toContain("Button.tsx#Button#abc");
    expect(output).toContain("disabled: true (inferred)");
  });

  it("prints a truthful notice when no standards are configured", () => {
    const output = renderLintReport(report({ standards: [] }), { verbose: false });

    expect(output).toContain("No standards are configured");
  });

  it("renders a deterministic summary line with counts and duration", () => {
    const output = renderLintReport(report(), { verbose: false });

    expect(output).toContain("Components  0 passed | 0 failed | 1 review | 0 skipped (1)");
    expect(output).toContain("Duration    1.42s");
  });

  it("only shows the Checks summary line when at least one check ran", () => {
    const withChecks = report({
      summary: {
        componentsPass: 1,
        componentsFail: 0,
        componentsReview: 0,
        componentsSkipped: 0,
        checksPass: 3,
        checksFail: 1,
        checksReview: 0,
        durationMs: 10,
      },
    });

    expect(renderLintReport(report(), { verbose: false })).not.toContain("Checks");
    expect(renderLintReport(withChecks, { verbose: false })).toContain("Checks      3 passed | 1 failed | 0 review (4)");
  });
});
