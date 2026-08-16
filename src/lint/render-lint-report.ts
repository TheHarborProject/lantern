import type { ComponentReport, LintReport, ReportStatus, StateReport } from "./types.js";

export interface RenderLintReportOptions {
  readonly verbose: boolean;
}

const STATUS_ICON: Record<ReportStatus, string> = {
  pass: "✓",
  fail: "✗",
  review: "•",
  skipped: "⚠",
};

/**
 * Render a {@link LintReport} as test-runner-style terminal text (RFC-007).
 *
 * Terminal text is derived entirely from the structured report — nothing here
 * decides pass/fail/skip on its own. Before RFC-008 attaches a real check
 * provider, every generated state carries no checks, so no check line is ever
 * printed: fabricating `✓`/`✗` check output ahead of a real engine would be
 * exactly the kind of untruthful reporting this RFC forbids.
 */
export function renderLintReport(report: LintReport, options: RenderLintReportOptions): string {
  const lines: string[] = [];

  for (const standard of report.standards) {
    lines.push(standard.standard, "");
    for (const component of standard.components) {
      lines.push(...renderComponent(component, options));
    }
    lines.push("");
  }

  if (report.standards.length === 0) {
    lines.push("No standards are configured — nothing to report.", "");
  }

  lines.push(...renderSummary(report));

  return lines.join("\n").replace(/\n+$/, "\n");
}

function renderComponent(component: ComponentReport, options: RenderLintReportOptions): string[] {
  const icon = STATUS_ICON[component.status];

  if (component.planStatus !== "ready") {
    return [`${icon} ${component.component}`, `  ↷ skipped — ${component.reason ?? "no reason given"}`];
  }

  const lines: string[] = [`${icon} ${component.component}`];
  const onlyState = component.states.length === 1 && !options.verbose ? component.states[0] : undefined;

  if (onlyState !== undefined) {
    // Avoid unnecessary state nesting for a component with one obvious state.
    lines.push(...renderStateChecks(onlyState, "  ", options));
  } else {
    for (const state of component.states) {
      lines.push(...renderState(state, options));
    }
  }

  if (component.truncated) {
    lines.push(
      `  ↷ ${component.states.length}/${component.totalPossibleStates} states shown (truncated at maxStates=${component.maxStates}; not exhaustive)`,
    );
  }

  return lines;
}

function renderState(state: StateReport, options: RenderLintReportOptions): string[] {
  const label = describeState(state);
  const lines = [`  ${STATUS_ICON[state.status]} ${label}`];
  lines.push(...renderStateChecks(state, "    ", options));
  return lines;
}

function renderStateChecks(state: StateReport, indent: string, options: RenderLintReportOptions): string[] {
  const lines: string[] = [];

  if (state.checks.length === 0) {
    lines.push(`${indent}no checks executed (no check provider configured)`);
  } else {
    for (const check of state.checks) {
      lines.push(`${indent}${STATUS_ICON[check.status]} ${check.message ?? check.ruleId}`);
      if (check.location !== undefined) {
        lines.push(`${indent}  ${check.location.file}${formatPosition(check.location)}`);
      }
      if (options.verbose) {
        lines.push(`${indent}  ${check.ruleId} (${check.severity})`);
      }
    }
  }

  if (options.verbose) {
    lines.push(`${indent}state: ${state.stateId}`);
    for (const [propName, source] of Object.entries(state.propProvenance)) {
      lines.push(`${indent}${propName}: ${JSON.stringify(state.props[propName])} (${source})`);
    }
  }

  return lines;
}

function describeState(state: StateReport): string {
  const values = Object.values(state.props).map((value) => JSON.stringify(value));
  return values.length === 0 ? "default" : values.join(" / ");
}

function formatPosition(location: { readonly line?: number; readonly column?: number }): string {
  if (location.line === undefined) {
    return "";
  }
  return location.column === undefined ? `:${location.line}` : `:${location.line}:${location.column}`;
}

function renderSummary(report: LintReport): string[] {
  const { summary } = report;
  const totalComponents =
    summary.componentsPass + summary.componentsFail + summary.componentsReview + summary.componentsSkipped;
  const totalChecks = summary.checksPass + summary.checksFail + summary.checksReview;

  const lines = [
    `Components  ${summary.componentsPass} passed | ${summary.componentsFail} failed | ${summary.componentsReview} review | ${summary.componentsSkipped} skipped (${totalComponents})`,
  ];
  if (totalChecks > 0) {
    lines.push(`Checks      ${summary.checksPass} passed | ${summary.checksFail} failed | ${summary.checksReview} review (${totalChecks})`);
  }
  lines.push(`Duration    ${(summary.durationMs / 1000).toFixed(2)}s`);

  return lines;
}
