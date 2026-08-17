import type {
  CheckResult,
  CheckStatus,
  ComponentReport,
  LintDiagnostic,
  LintReport,
  LintTargetSelectionInfo,
  ReportStatus,
  StandardReport,
  StateDimensionReport,
  StateReport,
} from "./types.js";

export interface RenderLintReportOptions {
  readonly verbose: boolean;
}

const STATUS_ICON: Record<ReportStatus, string> = {
  pass: "✓",
  fail: "✗",
  review: "◌",
  skipped: "↷",
};

const STANDARD_LABELS: Readonly<Record<string, string>> = {
  "wcag22-aa": "WCAG 2.2 AA",
  "wcag21-aa": "WCAG 2.1 AA",
  "rgaa4.1": "RGAA 4.1",
};

export function renderLintReport(report: LintReport, options: RenderLintReportOptions): string {
  const lines: string[] = ["Lantern lint", ""];

  pushSection(lines, renderTargeting(report, options));
  pushSection(lines, renderProvider(report));
  lines.push(...renderDiagnostics(report.diagnostics ?? [], options));

  for (const standard of report.standards) {
    lines.push(...renderStandard(standard, options), "");
  }

  if (report.standards.length === 0) {
    lines.push("No standards are configured. Nothing to report.", "");
  }

  lines.push(...renderSummary(report));
  return lines.join("\n").replace(/\n+$/, "\n");
}

function pushSection(lines: string[], section: readonly string[]): void {
  if (section.length > 0) {
    lines.push(...section, "");
  }
}

function renderTargeting(report: LintReport, options: RenderLintReportOptions): string[] {
  const { mode, selection } = report.targeting;
  if (mode.kind === "path" && selection?.kind === "path") {
    return [
      `Target     ${selection.path}`,
      ...(options.verbose ? [`Type       ${selection.pathKind}`] : []),
      `Selection  ${selection.componentCount === 0 ? "no components" : `${selection.componentCount} ${plural(selection.componentCount, "component", "components")}`}`,
    ];
  }
  if (mode.kind !== "since") {
    return [];
  }
  return [
    `Target     changes since ${mode.ref}`,
    `Selection  ${describeSelection(selection)}`,
    ...(selection?.kind === "fallback" ? [`Reason     ${selection.reason}`] : []),
  ];
}

function describeSelection(selection: LintTargetSelectionInfo | undefined): string {
  if (selection === undefined || selection.kind === "all") {
    return "full component set";
  }
  if (selection.kind === "none") {
    return "no affected components";
  }
  if (selection.kind === "affected") {
    return `${selection.componentCount} affected ${plural(selection.componentCount, "component", "components")}`;
  }
  return "full component set";
}

function renderProvider(report: LintReport): string[] {
  if (report.provider?.kind === "available") {
    return [`Provider   ${report.provider.provider}`];
  }
  if (report.provider?.kind === "unavailable") {
    return ["Provider   unavailable", `           ${report.provider.reason}`];
  }
  return [];
}

function renderDiagnostics(diagnostics: readonly LintDiagnostic[], options: RenderLintReportOptions): string[] {
  if (diagnostics.length === 0) {
    return [];
  }

  const lines = ["Review", ""];
  for (const diagnostic of diagnostics) {
    const target = diagnostic.component === undefined ? diagnostic.source : `${diagnostic.source}#${diagnostic.component}`;
    lines.push(`! ${target}`, `  ${diagnostic.message}`);
    if (options.verbose) {
      lines.push(`  source: ${diagnostic.source}`);
    }
  }
  lines.push("");
  return lines;
}

function renderStandard(standard: StandardReport, options: RenderLintReportOptions): string[] {
  const label = standardLabel(standard.standard);
  const lines = [`Standard   ${options.verbose && label !== standard.standard ? `${label} (${standard.standard})` : label}`, "", "Components", ""];
  for (const component of standard.components) {
    lines.push(...renderComponent(component, options), "");
  }
  return lines;
}

function renderComponent(component: ComponentReport, options: RenderLintReportOptions): string[] {
  const lines = [`${STATUS_ICON[component.status]} ${component.component}`];

  if (component.planStatus !== "ready") {
    lines.push(`  skipped · ${component.reason ?? "no reason given"}`);
    return lines;
  }

  lines.push(...renderPlanning(component));
  lines.push(...renderCheckSummary(component));

  const dimensions = component.dimensions ?? [];
  if (dimensions.length > 0 && options.verbose) {
    lines.push("", "  Dimensions");
    lines.push(...dimensions.map(renderDimension));
  }

  if (options.verbose && component.states.length > 0) {
    lines.push("", `  Showing ${component.states.length} selected states from ${component.totalPossibleStates} theoretical states`);
    lines.push(`  Selection: ${component.truncated ? "coverage-bounded" : "exhaustive"}`);
    component.states.forEach((state, index) => {
      lines.push(`  #${index + 1}  ${describeState(state)}`);
      lines.push(`      state: ${state.stateId}`);
      lines.push(...state.checks.map((check) => `      ${renderCheckLine(check)}`));
    });
  }

  return lines;
}

/**
 * Compact, default-visible summary of real check outcomes (RFC-008): one
 * line per distinct rule/status combination that is not a plain pass, so
 * normal output stays concise while still surfacing what actually failed or
 * needs review. Full per-state detail is reserved for `--verbose`.
 */
function renderCheckSummary(component: ComponentReport): string[] {
  const groups = groupChecks(component.states);
  return groups
    .filter((group) => group.status !== "pass")
    .map((group) => {
      const scope =
        group.count === component.states.length
          ? `${group.count} ${plural(group.count, "state", "states")}`
          : `${group.count}/${component.states.length} states`;
      const message = group.message === undefined ? "" : ` · ${group.message}`;
      return `  ${STATUS_ICON[group.status]} ${group.ruleId}  ${scope}${message}`;
    });
}

interface CheckGroup {
  readonly ruleId: string;
  readonly status: CheckStatus;
  readonly count: number;
  readonly message: string | undefined;
}

function groupChecks(states: readonly StateReport[]): CheckGroup[] {
  const groups = new Map<string, { ruleId: string; status: CheckStatus; count: number; message: string | undefined }>();
  for (const state of states) {
    for (const check of state.checks) {
      const key = `${check.ruleId}::${check.status}`;
      const existing = groups.get(key);
      if (existing === undefined) {
        groups.set(key, { ruleId: check.ruleId, status: check.status, count: 1, message: check.message });
      } else {
        existing.count += 1;
      }
    }
  }
  return [...groups.values()].sort((a, b) => (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0));
}

function renderCheckLine(check: CheckResult): string {
  const engine = check.engine === undefined ? "—" : `${check.engine.name}@${check.engine.version ?? "?"}`;
  const message = check.message === undefined ? "" : `  ${check.message}`;
  return `${STATUS_ICON[check.status]} ${check.ruleId}  ${engine}${message}`;
}

function renderPlanning(component: ComponentReport): string[] {
  const selected = component.states.length;
  if (component.truncated) {
    return [
      `  ${component.totalPossibleStates} states planned`,
      `  ${selected} selected · coverage-bounded`,
    ];
  }
  if (selected === 1) {
    return ["  1 state"];
  }
  return [`  ${selected} states · exhaustive`];
}

function renderDimension(dimension: StateDimensionReport): string {
  const valueList = dimension.values.map(formatValue).join(" | ");
  const clipped = valueList.length > 100 ? `${valueList.slice(0, 97)}...` : valueList;
  return `    ${dimension.name.padEnd(10)} ${clipped} (${dimension.source})`;
}

function describeState(state: StateReport): string {
  const entries = Object.entries(state.props);
  if (entries.length === 0) {
    return "default";
  }
  return entries.map(([name, value]) => `${name}=${formatValue(value)}`).join("  ");
}

function renderSummary(report: LintReport): string[] {
  const { summary } = report;
  const totalComponents =
    summary.componentsPass + summary.componentsFail + summary.componentsReview + summary.componentsSkipped;
  const totalChecks = summary.checksPass + summary.checksFail + summary.checksReview;
  const lines = [
    "Summary",
    `${totalComponents} ${plural(totalComponents, "component", "components")} · ${summary.componentsPass} passed · ${summary.componentsFail} failed · ${summary.componentsReview} review · ${summary.componentsSkipped} skipped`,
  ];
  if (totalChecks > 0) {
    lines.push(`${totalChecks} ${plural(totalChecks, "check", "checks")} · ${summary.checksPass} passed · ${summary.checksFail} failed · ${summary.checksReview} review`);
  }
  lines.push(`${(summary.durationMs / 1000).toFixed(2)}s`);
  return lines;
}

function standardLabel(id: string): string {
  return STANDARD_LABELS[id] ?? id;
}

function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
