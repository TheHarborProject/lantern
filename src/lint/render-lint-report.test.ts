import { describe, expect, it } from "vitest";
import { formatDuration, renderLintReport, STATUS_ICON } from "./render-lint-report.js";
import type { LintReport, StateReport } from "./types.js";
import { createTerminalStyle } from "../cli/terminal-style.js";

function report(): LintReport {
  return {
    version: 3, runId: "run-1", startedAt: new Date(0).toISOString(), finishedAt: new Date(0).toISOString(), status: "completed", generatedAt: new Date(0).toISOString(),
    targeting: { mode: { kind: "incremental" }, rescanned: true, selection: { kind: "all" } },
    provider: { kind: "available", provider: "lantern-static@1.0.0" }, engines: [],
    config: { standards: ["wcag22-aa"], rules: {} }, diagnostics: [],
    standards: [{ standard: "wcag22-aa", components: [{
      componentId: "src/Button.tsx#Button", component: "Button", source: "src/Button.tsx", planStatus: "ready", status: "fail",
      states: [{ componentId: "src/Button.tsx#Button", stateId: "state-1", props: { disabled: true }, propProvenance: { disabled: "inferred" }, status: "fail", checks: [{ checkId: "check-1", componentId: "src/Button.tsx#Button", stateId: "state-1", ruleId: "lantern/accessible-name", severity: "error", status: "fail", message: "Missing name", engine: { name: "lantern-static", version: "1.0.0" }, evidence: [{ kind: "expectation", expected: "a name", observed: "none" }], durationMs: 3 }] }],
      dimensions: [{ name: "disabled", values: [false, true], source: "inferred" }], truncated: true, totalPossibleStates: 2, maxStates: 1,
    }] }],
    summary: { componentsPass: 0, componentsFail: 1, componentsReview: 0, componentsSkipped: 0, checksPass: 0, checksFail: 1, checksReview: 0, durationMs: 810 },
  };
}

describe("renderLintReport", () => {
  it("renders only shared report counts in minimal mode", () => {
    const output = renderLintReport(report(), { mode: "minimal" });
    expect(output).toBe(" Components  1\n      Passed  0\n      Failed  1\n      Review  0\n     Skipped  0\n    Duration  810ms\n");
    expect(output).not.toContain("Lantern lint");
  });

  it("renders compact component identity, bounded coverage, and summary without diagnostics", () => {
    const output = renderLintReport(report(), { mode: "compact" });
    expect(output).toContain(" RUN  WCAG 2.2 AA");
    expect(output).toContain("✗ src/Button.tsx#Button");
    expect(output).toContain("1/2 states · coverage-bounded");
    expect(output).not.toContain("lantern/accessible-name");
    expect(output).toContain(" Components  1");
  });

  it("renders actionable state, check, engine, timing, and evidence detail in verbose mode", () => {
    const output = renderLintReport(report(), { mode: "verbose" });
    expect(output).toContain("Provider   lantern-static@1.0.0");
    expect(output).toContain("disabled: false | true (inferred)");
    expect(output).toContain("State\n     disabled=true");
    expect(output).not.toContain("state: state-1");
    expect(output).toContain("lantern/accessible-name · lantern-static@1.0.0 · 3ms");
    expect(output).toContain("Expected: a name · Observed: none");
  });

  it("aggregates repeated non-actionable states while retaining planning context", () => {
    const fixture = report();
    const ordinary = Array.from({ length: 50 }, (_, index): StateReport => ({
      componentId: "src/Button.tsx#Button", stateId: `ordinary-${index}`, props: { size: index }, propProvenance: { size: "inferred" }, checks: [], status: "review", outcomeReason: "not-applicable", reason: "No enabled accessibility check applies to this component's analyzed structure.",
    }));
    const component = fixture.standards[0]!.components[0]!;
    const output = renderLintReport({ ...fixture, standards: [{ ...fixture.standards[0]!, components: [{ ...component, status: "review", states: ordinary, totalPossibleStates: 96, truncated: true }] }] }, { mode: "verbose" });

    expect(output).toContain("50/96 states · coverage-bounded");
    expect(output).not.toContain("States:");
    expect(output).toContain("Dimensions");
    expect(output).toContain("Review\n     50 states not applicable");
    expect(output).toContain("Reason\n     No enabled accessibility check applies to this component's analyzed structure.");
    expect(output).not.toContain("ordinary-0");
    expect(output).not.toContain("ordinary-49");
    expect(output).not.toContain("State\n");
  });

  it("aggregates equivalent explanations separately and keeps operational unavailability distinct", () => {
    const fixture = report();
    const component = fixture.standards[0]!.components[0]!;
    const states: StateReport[] = [
      { componentId: component.componentId, stateId: "none-enabled", props: {}, propProvenance: {}, checks: [], status: "review", outcomeReason: "not-applicable", reason: "No accessibility rule is enabled for this component." },
      { componentId: component.componentId, stateId: "none-applies", props: {}, propProvenance: {}, checks: [], status: "review", outcomeReason: "not-applicable", reason: "No enabled accessibility check applies to this component's analyzed structure." },
      { componentId: component.componentId, stateId: "engine-unavailable", props: {}, propProvenance: {}, checks: [], status: "review", outcomeReason: "unavailable", reason: "No accessibility engine is enabled, so these states could not be evaluated." },
    ];
    const output = renderLintReport({ ...fixture, standards: [{ ...fixture.standards[0]!, components: [{ ...component, status: "review", states, truncated: false, totalPossibleStates: 3 }] }] }, { mode: "verbose" });

    expect(output.match(/1 state not applicable/g)).toHaveLength(2);
    expect(output).toContain("1 state could not be evaluated");
    expect(output).toContain("No accessibility rule is enabled for this component.");
    expect(output).toContain("No enabled accessibility check applies to this component's analyzed structure.");
    expect(output).toContain("No accessibility engine is enabled, so these states could not be evaluated.");
  });

  it("expands an actionable review state alongside aggregated ordinary states", () => {
    const fixture = report();
    const component = fixture.standards[0]!.components[0]!;
    const review: StateReport = {
      componentId: component.componentId, stateId: "review-id", props: { disabled: false }, propProvenance: { disabled: "inferred" }, status: "review", outcomeReason: "manual-review",
      checks: [{ checkId: "review-check", componentId: component.componentId, stateId: "review-id", ruleId: "lantern/focus-visible", severity: "warn", status: "review", outcomeReason: "manual-review", reason: "Inspect the focus indicator", evidence: [], durationMs: 2 }],
    };
    const ordinary: StateReport = { ...review, stateId: "ordinary-id", props: { disabled: true }, checks: [], outcomeReason: "not-applicable" };
    const output = renderLintReport({ ...fixture, standards: [{ ...fixture.standards[0]!, components: [{ ...component, status: "review", states: [ordinary, review], totalPossibleStates: 2, truncated: false }] }] }, { mode: "verbose" });

    expect(output).toContain("1 state not applicable");
    expect(output).toContain("State\n     disabled=false");
    expect(output).toContain("lantern/focus-visible");
    expect(output).toContain("Inspect the focus indicator");
    expect(output).not.toContain("review-id");
  });

  it("uses one human duration formatter and identical summary counts in every mode", () => {
    expect(formatDuration(640)).toBe("640ms");
    expect(formatDuration(1240)).toBe("1.24s");
    const summaries = (["minimal", "compact", "verbose"] as const).map((mode) => renderLintReport(report(), { mode }).slice(renderLintReport(report(), { mode }).indexOf(" Components")));
    expect(new Set(summaries).size).toBe(1);
  });

  it("uses stable status icons and can disable ANSI output", () => {
    expect(STATUS_ICON).toEqual({ pass: "✓", fail: "✗", review: "◌", skipped: "↷" });
    expect(renderLintReport(report(), { mode: "compact", color: false })).not.toContain("\u001b[");
    expect(renderLintReport(report(), { mode: "compact", color: true })).toContain("\u001b[");
  });

  it("applies compact hierarchy through semantic styles", () => {
    const style = createTerminalStyle(true);
    const output = renderLintReport(report(), { mode: "compact", color: true });
    expect(output).toContain(style.accent(style.strong(" RUN ")));
    expect(output).toContain(style.failure("✗"));
    expect(output).toContain(style.review("coverage-bounded"));
    expect(output).toContain(style.muted("src/Button.tsx"));
  });

  it("styles the shared minimal summary by semantic status", () => {
    const style = createTerminalStyle(true);
    const output = renderLintReport(report(), { mode: "minimal", color: true });
    expect(output).toContain(style.strong(" Components  1"));
    expect(output).toContain(style.success("      Passed  0"));
    expect(output).toContain(style.failure("      Failed  1"));
    expect(output).toContain(style.review("      Review  0"));
    expect(output).toContain(style.skipped("     Skipped  0"));
  });

  it("styles verbose section labels and secondary provider metadata", () => {
    const style = createTerminalStyle(true);
    const output = renderLintReport(report(), { mode: "verbose", color: true });
    expect(output).toContain(style.strong("Provider"));
    expect(output).toContain(style.strong("Standard"));
    expect(output).toContain(style.strong("Dimensions"));
    expect(output).toContain(style.strong("State"));
    expect(output).toContain(style.muted("lantern-static@1.0.0"));
  });
});
