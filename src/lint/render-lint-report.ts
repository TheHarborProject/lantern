import type { OutputMode } from "../schemas/output.js";
import { createTerminalStyle, type TerminalStyle } from "../cli/terminal-style.js";
import type { CheckResult, ComponentReport, EvidenceRecord, LintReport, ReportStatus, StateReport } from "./types.js";

export interface RenderLintReportOptions { readonly mode?: OutputMode; readonly verbose?: boolean; readonly color?: boolean; }
export const STATUS_ICON: Readonly<Record<ReportStatus, string>> = { pass: "✓", fail: "✗", review: "◌", skipped: "↷" };
const STANDARD_LABELS: Readonly<Record<string, string>> = { "wcag22-aa": "WCAG 2.2 AA", "wcag21-aa": "WCAG 2.1 AA", "rgaa4.1": "RGAA 4.1" };

export function renderLintReport(report: LintReport, options: RenderLintReportOptions = {}): string {
  const mode = options.mode ?? (options.verbose === true ? "verbose" : "compact");
  const style = createTerminalStyle(options.color === true);
  const lines = mode === "minimal" ? renderSummary(report, style) : renderHuman(report, mode, style);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function renderHuman(report: LintReport, mode: "compact" | "verbose", style: TerminalStyle): string[] {
  const standards = report.standards.map((standard) => standardLabel(standard.standard)).join(", ") || "No standards";
  const lines = [style.strong("Lantern lint"), "", `${style.accent(style.strong(" RUN "))} ${style.strong(standards)}`, ""];
  const targetLines = renderTargetDetails(report, style);
  if (targetLines.length > 0) lines.push(...targetLines, "");
  if (mode === "verbose") {
    lines.push(...renderRunDetails(report, style), "");
  }
  for (const diagnostic of report.diagnostics ?? []) lines.push(`${style.error("!")} ${style.strong(identity(diagnostic.source, diagnostic.component))}`, `  ${diagnostic.message}`);
  if ((report.diagnostics?.length ?? 0) > 0) lines.push("");
  for (const standard of report.standards) {
    if (mode === "verbose") lines.push(`${style.strong("Standard")}   ${style.strong(standardLabel(standard.standard))} ${style.muted(`(${standard.standard})`)}`, "");
    for (const component of standard.components) lines.push(...renderComponent(component, mode, style));
  }
  lines.push("", ...renderSummary(report, style));
  return lines;
}

function renderRunDetails(report: LintReport, style: TerminalStyle): string[] {
  const lines: string[] = [];
  if (report.provider?.kind === "available") lines.push(`${style.strong("Provider")}   ${style.muted(report.provider.provider)}`);
  if (report.provider?.kind === "unavailable") lines.push(`${style.strong("Provider")}   ${style.failure("unavailable")}`, `           ${style.muted(report.provider.reason)}`);
  return lines;
}

function renderTargetDetails(report: LintReport, style: TerminalStyle): string[] {
  const lines: string[] = [];
  const target = report.targeting.mode;
  if (target.kind === "path") {
    lines.push(`${style.strong("Target")}     ${style.muted(target.path)}`);
    if (report.targeting.selection?.kind === "path") {
      const count = report.targeting.selection.componentCount;
      lines.push(`${style.strong("Selection")}  ${style.muted(count === 0 ? "no components" : `${count} ${count === 1 ? "component" : "components"}`)}`);
    }
  }
  if (target.kind === "since") lines.push(`${style.strong("Target")}     ${style.muted(`changes since ${target.ref}`)}`);
  return lines;
}

function renderComponent(component: ComponentReport, mode: "compact" | "verbose", style: TerminalStyle): string[] {
  const lines = [` ${styleStatus(style, component.status, STATUS_ICON[component.status])} ${style.muted(component.source)}#${style.strong(component.component)}`];
  if (component.planStatus !== "ready") {
    if (mode === "verbose") lines.push(`   ${style.strong("Reason:")} ${styleStatus(style, component.status, component.reason ?? component.outcomeReason ?? "skipped")}`);
    return lines;
  }
  if (component.truncated) lines.push(`   ${style.muted(`${component.states.length}/${component.totalPossibleStates} states ·`)} ${style.review("coverage-bounded")}`);
  if (mode === "verbose") {
    if ((component.dimensions?.length ?? 0) > 0) {
      lines.push(`   ${style.strong("Dimensions")}`);
      for (const dimension of component.dimensions ?? []) lines.push(`     ${style.strong(`${dimension.name}:`)} ${dimension.values.map(formatValue).join(" | ")} ${style.muted(`(${dimension.source})`)}`);
    }
    const { actionable, aggregated } = partitionStates(component.states);
    for (const group of aggregated) {
      lines.push(`   ${style.strong(group.heading)}`, `     ${style.review(`${group.count} ${plural(group.count, "state", "states")} ${group.description}`)}`);
    }
    for (const state of actionable) lines.push(...renderState(state, style));
  }
  return lines;
}

interface AggregatedStates {
  readonly heading: string;
  readonly description: string;
  readonly count: number;
}

function partitionStates(states: readonly StateReport[]): { actionable: StateReport[]; aggregated: AggregatedStates[] } {
  const actionable: StateReport[] = [];
  const groups = new Map<string, AggregatedStates>();
  for (const state of states) {
    if (isActionableState(state)) {
      actionable.push(state);
      continue;
    }
    const aggregate = describeAggregate(state);
    const key = `${aggregate.heading}:${aggregate.description}`;
    const existing = groups.get(key);
    groups.set(key, { ...aggregate, count: (existing?.count ?? 0) + 1 });
  }
  return { actionable, aggregated: [...groups.values()] };
}

function isActionableState(state: StateReport): boolean {
  if (state.status === "fail" || state.status === "skipped") return true;
  if (state.checks.some(isActionableCheck)) return true;
  return state.status === "review" && state.outcomeReason !== "not-applicable";
}

function isActionableCheck(check: CheckResult): boolean {
  if (check.status === "fail") return true;
  if (check.status === "pass") return false;
  return check.outcomeReason !== "not-applicable" || check.message !== undefined || check.reason !== undefined || check.evidence.length > 0;
}

function describeAggregate(state: StateReport): Omit<AggregatedStates, "count"> {
  if (state.outcomeReason === "not-applicable") return { heading: "Review", description: "not applicable" };
  if (state.status === "pass") return { heading: "Passed", description: "passed" };
  return { heading: "Review", description: state.outcomeReason?.replaceAll("-", " ") ?? "without individual diagnostics" };
}

function renderState(state: StateReport, style: TerminalStyle): string[] {
  const props = Object.entries(state.props).map(([key, value]) => `${key}=${formatValue(value)}`).join("  ") || "default";
  const lines = [`   ${style.strong("State")}`, `     ${props}`];
  if (state.outcomeReason !== undefined) lines.push(`     ${style.strong("Reason:")} ${styleStatus(style, state.status, state.outcomeReason.replaceAll("-", " "))}`);
  for (const check of state.checks.filter(isActionableCheck)) lines.push(...renderCheck(check, style));
  return lines;
}

function renderCheck(check: CheckResult, style: TerminalStyle): string[] {
  const engine = check.engine === undefined ? "unknown engine" : `${check.engine.name}@${check.engine.version ?? "?"}`;
  const lines = [`      ${styleStatus(style, check.status, STATUS_ICON[check.status])} ${style.strong(check.ruleId)} ${style.muted(`· ${engine} · ${check.durationMs.toFixed(0)}ms`)}`];
  if (check.message !== undefined) lines.push(`        ${check.message}`);
  if (check.reason !== undefined || check.outcomeReason !== undefined) lines.push(`        Reason: ${check.reason ?? check.outcomeReason}`);
  for (const evidence of check.evidence) lines.push(`        ${renderEvidence(evidence, style)}`);
  return lines;
}

function renderEvidence(evidence: EvidenceRecord, style: TerminalStyle): string {
  if (evidence.kind === "expectation") return `${style.strong("Expected:")} ${evidence.expected} · ${style.strong("Observed:")} ${evidence.observed}`;
  if (evidence.kind === "observation") return `${style.strong(`${evidence.name}:`)} ${formatValue(evidence.value)}`;
  if (evidence.kind === "attribute") return `${style.strong(`${evidence.name}:`)} ${formatValue(evidence.value)}`;
  if (evidence.kind === "element") return `${style.strong("Element:")} ${evidence.selector ?? evidence.html ?? "unknown"}`;
  if (evidence.kind === "source") return `${style.strong("Source:")} ${style.muted(`${evidence.location.file}${evidence.location.line === undefined ? "" : `:${evidence.location.line}`}`)}`;
  return `${style.strong("Required capability:")} ${evidence.required}`;
}

function renderSummary(report: LintReport, style: TerminalStyle): string[] {
  const s = report.summary;
  const total = s.componentsPass + s.componentsFail + s.componentsReview + s.componentsSkipped;
  return [style.strong(` Components  ${total}`), style.success(`      Passed  ${s.componentsPass}`), style.failure(`      Failed  ${s.componentsFail}`), style.review(`      Review  ${s.componentsReview}`), style.skipped(`     Skipped  ${s.componentsSkipped}`), style.muted(`    Duration  ${formatDuration(s.durationMs)}`)];
}

function identity(source: string, component?: string): string { return component === undefined ? source : `${source}#${component}`; }
function standardLabel(id: string): string { return STANDARD_LABELS[id] ?? id; }
function formatValue(value: unknown): string { return typeof value === "string" ? value : JSON.stringify(value); }
export function formatDuration(durationMs: number): string { return durationMs < 1000 ? `${Math.round(durationMs)}ms` : `${(durationMs / 1000).toFixed(2)}s`; }
function plural(count: number, singular: string, pluralForm: string): string { return count === 1 ? singular : pluralForm; }
function styleStatus(style: TerminalStyle, status: ReportStatus, value: string): string {
  return status === "pass" ? style.success(value) : status === "fail" ? style.failure(value) : status === "review" ? style.review(value) : style.skipped(value);
}
