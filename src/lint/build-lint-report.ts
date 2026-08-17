import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Browser } from "playwright";
import { LanternError } from "../errors/lantern-error.js";
import { LintSelectionError } from "../errors/lint-selection-error.js";
import { resolveRulesForFile } from "../config/resolve/resolve-rules-for-file.js";
import { createLintExecutionSession } from "../component-runtime/runtime-session.js";
import { resolveIsolationGlobals } from "../component-runtime/resolve-isolation-globals.js";
import type { ComponentBundler, IsolationComponentTarget, LintExecutionSession } from "../component-runtime/types.js";
import { projectAccessibility } from "../component-scan/project-accessibility.js";
import { createEnabledEngines } from "../engines/create-enabled-engines.js";
import { executePlannedChecks } from "../engines/execute-checks.js";
import { matchEngine } from "../engines/match-engine.js";
import { planChecksForComponent } from "../engines/plan-checks.js";
import { resolveActiveRules } from "../engines/resolve-active-rules.js";
import { ruleStandardsIndex } from "../engines/rule-registry.js";
import type { Engine } from "../engines/types.js";
import { DEFAULT_MAX_STATES, planComponentState } from "../state-planning/plan-component-state.js";
import type { ComponentStatePlan, ResolvedPropValues } from "../state-planning/types.js";
import type { Standard } from "../schemas/standards.js";
import type { AccessibilityComponent, CanonicalComponent, CanonicalComponentModel } from "../types/component-scan.js";
import type { ResolvedConfig } from "../types/config.js";
import { resolveLintTargets } from "./resolve-lint-targets.js";
import type {
  CheckResult,
  ComponentReport,
  LintDiagnostic,
  LintReport,
  LintSummary,
  LintTargetMode,
  ProviderStatus,
  ReportStatus,
  StandardReport,
  StatePropProvenance,
  StateReport,
} from "./types.js";
import { AuditCancelledError, throwIfCancelled, type AuditEventSink } from "./events.js";

export interface BuildLintReportOptions {
  readonly config: ResolvedConfig;
  readonly mode: LintTargetMode;
  readonly maxStates?: number | undefined;
  readonly cwd?: string | undefined;
  readonly mountTimeoutMs?: number | undefined;
  /** Injected bundler, for tests; defaults to the esbuild-backed implementation. */
  readonly bundle?: ComponentBundler | undefined;
  /** Injected browser launcher, for tests; defaults to headless Chromium. */
  readonly launch?: (() => Promise<Browser>) | undefined;
  readonly componentIds?: readonly string[] | undefined;
  readonly stateIds?: readonly string[] | undefined;
  readonly checkIds?: readonly string[] | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly events?: AuditEventSink | undefined;
}

/**
 * Orchestrate `lantern lint` (RFC-007, real checks attached by RFC-008):
 * resolve targets (RFC-002/004 discovery, reused as-is), plan each targeted
 * component's states (RFC-006, reused as-is), plan and execute the checks
 * each component's active rules require (RFC-008), and assemble the
 * structured report. Rendered checks reuse one `LintExecutionSession` (RFC-
 * 007.5) for the whole run: the browser launches at most once, lazily, only
 * if a planned check actually needs it.
 */
export async function buildLintReport(options: BuildLintReportOptions): Promise<LintReport> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  await options.events?.({ type: "run-started", runId, timestamp: startedAt });
  try {
    const report = await buildSuccessfulLintReport(options, runId, startedAt);
    await options.events?.({ type: "run-completed", runId, timestamp: report.finishedAt, report });
    return report;
  } catch (error) {
    // A typed Lantern error raised before any component was attempted (bad
    // target path, invalid selection, ...) is an input-validation failure,
    // never an operational engine failure: preserve its own type/code and
    // `--debug` stack/cause fidelity by letting it propagate exactly as it
    // did before RFC-009, instead of downgrading it to a generic diagnostic.
    if (!(error instanceof PartialRunFailure) && error instanceof LanternError) {
      throw error;
    }

    const cause = error instanceof PartialRunFailure ? error.cause : error;
    const collectedComponents = error instanceof PartialRunFailure ? error.componentReports : [];
    const collectedDiagnostics = error instanceof PartialRunFailure ? error.diagnostics : [];
    const cancelled = cause instanceof AuditCancelledError || options.signal?.aborted === true;
    const finishedAt = new Date().toISOString();
    const diagnostic = operationalDiagnostic(cause, cancelled);
    const report = failedReport(options, runId, startedAt, finishedAt, cancelled, diagnostic, collectedComponents, collectedDiagnostics);
    await options.events?.({ type: "diagnostic", runId, timestamp: finishedAt, diagnostic });
    await options.events?.({ type: cancelled ? "run-cancelled" : "run-failed", runId, timestamp: finishedAt, report });
    return report;
  }
}

/**
 * Wraps an error raised while components were already being processed, so
 * whatever was already collected survives into the run's failure report
 * instead of being discarded (RFC-009.1): a browser-session-wide failure
 * (e.g. the browser fails to launch) still ends the run, but every component
 * report and check diagnostic gathered before that point remains inspectable.
 */
class PartialRunFailure extends Error {
  readonly componentReports: readonly ComponentReport[];
  readonly diagnostics: readonly LintDiagnostic[];

  constructor(cause: unknown, componentReports: readonly ComponentReport[], diagnostics: readonly LintDiagnostic[]) {
    super("Audit run failed after partially completing.", { cause });
    this.name = "PartialRunFailure";
    this.componentReports = componentReports;
    this.diagnostics = diagnostics;
  }
}

async function buildSuccessfulLintReport(options: BuildLintReportOptions, runId: string, startedAtIso: string): Promise<LintReport> {
  const { config, mode, maxStates = DEFAULT_MAX_STATES, cwd } = options;
  const startedAt = Date.now();
  throwIfCancelled(options.signal);

  const targets = resolveLintTargets({
    root: config.project.root,
    sourceDirectory: config.project.sourceDirectory,
    cwd,
    ignorePatterns: config.ignorePatterns,
    mode,
  });
  const accessibilityById = indexAccessibility(targets.model);
  const requestedIds = validateSelection(options, targets.model);
  const includedComponents = filterComponents(targets.model, requestedIds ?? targets.targetComponentIds);
  const configResolution = resolveComponentConfigs(includedComponents, config);

  const engines = createEnabledEngines(config.engines);
  const session = createLintExecutionSession({
    projectRoot: config.project.root,
    globals: resolveIsolationGlobals(config.project.root, config.isolation),
    mountTimeoutMs: options.mountTimeoutMs,
    bundle: options.bundle,
    launch: options.launch,
  });

  const componentReports: ComponentReport[] = [];
  const checkDiagnostics: LintDiagnostic[] = [];
  try {
    // Sequential by design (RFC-008 defers concurrency): normalized result
    // ordering must never depend on browser/engine completion order.
    for (const component of includedComponents) {
      throwIfCancelled(options.signal);
      await options.events?.({ type: "component-started", runId, timestamp: new Date().toISOString(), componentId: component.id });
      const report = await buildComponentReport(
        component,
        accessibilityById,
        config,
        maxStates,
        configResolution.configsById,
        engines,
        session,
        { runId, signal: options.signal, events: options.events, stateIds: options.stateIds, checkIds: options.checkIds, diagnostics: checkDiagnostics },
      );
      componentReports.push(report);
      await options.events?.({ type: "component-completed", runId, timestamp: new Date().toISOString(), component: report });
    }
  } catch (error) {
    // Whatever was already collected (components, and their check-level
    // operational diagnostics) survives into the run's failure report — see
    // `PartialRunFailure`.
    throw new PartialRunFailure(error, componentReports, checkDiagnostics);
  } finally {
    await session.close();
  }

  // Standards (RFC-005) stay separate evaluation contexts: the same executed
  // evidence is filtered per standard via each rule's declared standard
  // mapping, never merged into one synthetic compliance result. Every known
  // rule currently maps to every standard (see `rule-registry.ts`), so
  // filtering is a no-op today; `componentsForStandard` still reuses
  // `componentReports` verbatim whenever that holds, keeping the "planning
  // is standard-independent" property structurally visible rather than an
  // implementation detail a reader has to trust.
  const ruleStandards = ruleStandardsIndex();
  const standards: StandardReport[] = config.standards.map((standard) => ({
    standard,
    components: componentsForStandard(componentReports, standard, ruleStandards),
  }));

  const finishedAt = new Date().toISOString();
  return {
    version: 3,
    runId,
    startedAt: startedAtIso,
    finishedAt,
    status: "completed",
    generatedAt: startedAtIso,
    targeting: { mode, rescanned: targets.rescanned, selection: targets.selection },
    provider: describeProvider(engines),
    engines: engines.map((engine) => ({ ...engine.identity, capabilities: engine.capabilities })),
    config: { standards: config.standards, rules: snapshotRules(config.rules) },
    diagnostics: [
      ...targets.model.diagnostics.map((diagnostic): LintDiagnostic => ({
        code: "COMPONENT_ANALYSIS",
        severity: "warning",
        scope: "component",
        source: diagnostic.source,
        component: diagnostic.exportName,
        message: diagnostic.message,
      })),
      ...configResolution.diagnostics,
      ...checkDiagnostics,
    ],
    standards,
    summary: summarizePlanning(componentReports, Date.now() - startedAt),
  };
}

function indexAccessibility(model: CanonicalComponentModel): ReadonlyMap<string, AccessibilityComponent> {
  return new Map(projectAccessibility(model).components.map((component) => [component.id, component]));
}

function filterComponents(
  model: CanonicalComponentModel,
  targetComponentIds: ReadonlySet<string> | undefined,
): readonly CanonicalComponent[] {
  if (targetComponentIds === undefined) {
    return model.components;
  }
  return model.components.filter((component) => targetComponentIds.has(component.id));
}

function describeProvider(engines: readonly Engine[]): ProviderStatus {
  if (engines.length === 0) {
    return { kind: "unavailable", reason: "no engines are enabled in configuration" };
  }
  return {
    kind: "available",
    provider: engines.map((engine) => `${engine.identity.id}@${engine.identity.version}`).join(", "),
  };
}

async function buildComponentReport(
  component: CanonicalComponent,
  accessibilityById: ReadonlyMap<string, AccessibilityComponent>,
  config: ResolvedConfig,
  maxStates: number,
  configsById: ReadonlyMap<string, NonNullable<ResolvedConfig["components"][string]>>,
  engines: readonly Engine[],
  session: LintExecutionSession,
  execution: {
    readonly runId: string;
    readonly signal?: AbortSignal | undefined;
    readonly events?: AuditEventSink | undefined;
    readonly stateIds?: readonly string[] | undefined;
    readonly checkIds?: readonly string[] | undefined;
    /** Mutable accumulator: check-level operational-error diagnostics discovered while building this component. */
    readonly diagnostics: LintDiagnostic[];
  },
): Promise<ComponentReport> {
  const accessibility = accessibilityById.get(component.id) ?? emptyAccessibility(component);
  const componentConfig = configsById.get(component.id);

  const plan = planComponentState({
    component,
    accessibility,
    componentConfig,
    fixtures: config.fixtures,
    maxStates,
  });

  if (plan.status !== "ready" || engines.length === 0) {
    return toComponentReport(component, plan, maxStates, new Map());
  }

  const activeRules = resolveActiveRules(resolveRulesForFile({ rules: config.rules, overrides: config.overrides }, component.source));
  const selectedStates = execution.stateIds === undefined ? plan.states : plan.states.filter((state) => execution.stateIds?.includes(state.id));
  let plannedChecks = planChecksForComponent({ component, accessibility, states: selectedStates, activeRules });
  if (execution.checkIds !== undefined) plannedChecks = plannedChecks.filter((check) => execution.checkIds?.includes(check.checkId));

  if (plannedChecks.length === 0) {
    return toComponentReport(component, plan, maxStates, new Map());
  }

  // Only launch/reuse the runtime when a capability-matched engine will
  // actually render — an enabled-but-unsupported rendered-dom rule (e.g. an
  // unimplemented one, see `rule-registry.ts`) must never pay for a browser
  // it will never use.
  const requiresRuntime = plannedChecks.some((check) => {
    const matched = matchEngine(check, engines);
    return "engine" in matched && matched.engine.capabilities.includes("rendered-dom");
  });
  const runtime = requiresRuntime ? await session.componentRuntime(runtimeTarget(component, config)) : undefined;

  const checksByState = new Map<string, CheckResult[]>();
  for (const state of selectedStates) {
    throwIfCancelled(execution.signal);
    await execution.events?.({ type: "state-started", runId: execution.runId, timestamp: new Date().toISOString(), componentId: component.id, stateId: state.id });
    const stateChecks = plannedChecks.filter((check) => check.stateId === state.id);
    for (const check of stateChecks) {
      throwIfCancelled(execution.signal);
      await execution.events?.({ type: "check-started", runId: execution.runId, timestamp: new Date().toISOString(), componentId: component.id, stateId: state.id, checkId: check.checkId, ruleId: check.ruleId });
      const [executed] = await executePlannedChecks([check], engines, () => ({ runtime }));
      throwIfCancelled(execution.signal);
      if (executed !== undefined) {
        (checksByState.get(state.id) ?? (checksByState.set(state.id, []), checksByState.get(state.id)!)).push(executed.result);
        await execution.events?.({ type: "check-completed", runId: execution.runId, timestamp: new Date().toISOString(), result: executed.result });
        if (executed.result.outcomeReason === "operational-error") {
          const diagnostic: LintDiagnostic = {
            code: "CHECK_OPERATIONAL_ERROR",
            severity: "error",
            scope: "check",
            source: component.source,
            component: component.name,
            componentId: component.id,
            stateId: state.id,
            checkId: check.checkId,
            engine: executed.result.engine,
            message: executed.result.reason ?? executed.result.message ?? `"${check.ruleId}" failed operationally for "${component.name}".`,
          };
          execution.diagnostics.push(diagnostic);
          await execution.events?.({ type: "diagnostic", runId: execution.runId, timestamp: new Date().toISOString(), diagnostic });
        }
      }
    }
    await execution.events?.({
      type: "state-completed",
      runId: execution.runId,
      timestamp: new Date().toISOString(),
      state: {
        componentId: component.id,
        stateId: state.id,
        props: state.props,
        propProvenance: buildProvenance(plan.dimensions, plan.fixedProps),
        checks: checksByState.get(state.id) ?? [],
        status: aggregateCheckStatus(checksByState.get(state.id) ?? []),
        ...((checksByState.get(state.id)?.length ?? 0) === 0 ? { outcomeReason: "not-applicable" as const } : {}),
      },
    });
  }

  const report = toComponentReport(component, { ...plan, states: selectedStates }, maxStates, checksByState);
  return report;
}

function runtimeTarget(component: CanonicalComponent, config: ResolvedConfig): IsolationComponentTarget {
  return {
    name: component.name,
    sourcePath: resolve(config.project.root, component.source),
    exportName: component.exportName,
  };
}

function resolveComponentConfigs(
  components: readonly CanonicalComponent[],
  config: ResolvedConfig,
): {
  readonly configsById: ReadonlyMap<string, NonNullable<ResolvedConfig["components"][string]>>;
  readonly diagnostics: readonly LintDiagnostic[];
} {
  const configsById = new Map<string, NonNullable<ResolvedConfig["components"][string]>>();
  const diagnostics: LintDiagnostic[] = [];
  const idsByName = new Map<string, string[]>();

  for (const component of components) {
    idsByName.set(component.name, [...(idsByName.get(component.name) ?? []), component.id]);
  }

  for (const [key, componentConfig] of Object.entries(config.components)) {
    const exact = components.find((component) => component.id === key);
    if (exact !== undefined) {
      configsById.set(exact.id, componentConfig);
      continue;
    }

    const matchingIds = idsByName.get(key) ?? [];
    if (matchingIds.length === 1) {
      configsById.set(matchingIds[0] ?? "", componentConfig);
    } else if (matchingIds.length > 1) {
      diagnostics.push({
        code: "AMBIGUOUS_COMPONENT_CONFIG",
        severity: "warning",
        scope: "component",
        source: "lantern.config.json",
        component: key,
        message: `Component config key "${key}" is ambiguous; use one of: ${matchingIds.join(", ")}.`,
      });
    }
  }

  return { configsById, diagnostics };
}

function toComponentReport(
  component: CanonicalComponent,
  plan: ComponentStatePlan,
  maxStates: number,
  checksByState: ReadonlyMap<string, readonly CheckResult[]>,
): ComponentReport {
  const base = {
    componentId: component.id,
    component: component.name,
    source: component.source,
  };

  if (plan.status === "skipped") {
    return {
      ...base,
      planStatus: "skipped",
      status: "skipped",
      outcomeReason: "skipped",
      states: [],
      dimensions: [],
      reason: "Explicitly skipped in configuration.",
      truncated: false,
      totalPossibleStates: 0,
      maxStates,
    };
  }

  if (plan.status === "unresolved") {
    return {
      ...base,
      planStatus: "unresolved",
      status: "skipped",
      outcomeReason: "unavailable",
      states: [],
      dimensions: [],
      unresolvedProps: plan.unresolvedProps,
      reason: describeUnresolved(plan.unresolvedProps.map((prop) => prop.name)),
      truncated: false,
      totalPossibleStates: 0,
      maxStates,
    };
  }

  const states: StateReport[] = plan.states.map((state) => {
    const checks = checksByState.get(state.id) ?? [];
    return {
      stateId: state.id,
      componentId: component.id,
      props: state.props,
      propProvenance: buildProvenance(plan.dimensions, plan.fixedProps),
      checks,
      // "review" whenever nothing was actually verified for this state
      // (empty `checks`): never a fabricated "pass".
      status: aggregateCheckStatus(checks),
      ...(checks.length === 0 ? { outcomeReason: "not-applicable" as const } : {}),
    };
  });

  return {
    ...base,
    planStatus: "ready",
    status: aggregateStatus(states.map((state) => state.status)),
    states,
    dimensions: plan.dimensions.map((dimension) => ({
      name: dimension.name,
      values: dimension.values,
      source: dimension.source,
    })),
    truncated: plan.truncated,
    totalPossibleStates: plan.totalPossibleStates,
    maxStates: plan.maxStates,
  };
}

/**
 * Project one component's report into a single standard's evaluation context
 * (RFC-005/008): keep only checks whose rule maps to `standard`, and
 * recompute state/component status from that filtered set. Distinct
 * standards can therefore genuinely disagree — they are never collapsed into
 * one synthetic result.
 */
/**
 * Reuses `componentReports` verbatim whenever no component actually differs
 * once projected for `standard` — true today, since every known rule maps to
 * every standard (see `rule-registry.ts`) — instead of always allocating a
 * fresh array whose contents happen to be identical.
 */
function componentsForStandard(
  componentReports: readonly ComponentReport[],
  standard: Standard,
  ruleStandards: ReadonlyMap<string, ReadonlySet<Standard>>,
): readonly ComponentReport[] {
  const projected = componentReports.map((component) => projectComponentForStandard(component, standard, ruleStandards));
  const unchanged = projected.every((component, index) => component === componentReports[index]);
  return unchanged ? componentReports : projected;
}

function projectComponentForStandard(
  component: ComponentReport,
  standard: Standard,
  ruleStandards: ReadonlyMap<string, ReadonlySet<Standard>>,
): ComponentReport {
  if (component.planStatus !== "ready") {
    return component;
  }

  const states: StateReport[] = component.states.map((state) => {
    const checks = state.checks.filter((check) => ruleStandards.get(check.ruleId)?.has(standard) ?? false);
    if (checks.length === state.checks.length) {
      return state;
    }
    return { ...state, checks, status: aggregateCheckStatus(checks) };
  });

  if (states.every((state, index) => state === component.states[index])) {
    return component;
  }
  return { ...component, states, status: aggregateStatus(states.map((state) => state.status)) };
}

function buildProvenance(dimensions: readonly ResolvedPropValues[], fixed: readonly ResolvedPropValues[] = []): StatePropProvenance {
  const provenance: Record<string, ResolvedPropValues["source"]> = {};
  for (const dimension of [...dimensions, ...fixed]) {
    provenance[dimension.name] = dimension.source;
  }
  return provenance;
}

function describeUnresolved(propNames: readonly string[]): string {
  const list = propNames.map((name) => `"${name}"`).join(", ");
  return propNames.length === 1
    ? `required prop ${list} has no configured or inferred value`
    : `required props ${list} have no configured or inferred value`;
}

function aggregateCheckStatus(checks: readonly CheckResult[]): ReportStatus {
  if (checks.length === 0) {
    return "review";
  }
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "review")) {
    return "review";
  }
  return "pass";
}

function aggregateStatus(statuses: readonly ReportStatus[]): ReportStatus {
  if (statuses.length === 0) {
    return "review";
  }
  if (statuses.includes("fail")) {
    return "fail";
  }
  if (statuses.includes("review")) {
    return "review";
  }
  if (statuses.every((status) => status === "skipped")) {
    return "skipped";
  }
  return "pass";
}

function emptyAccessibility(component: CanonicalComponent): AccessibilityComponent {
  return {
    id: component.id,
    name: component.name,
    source: component.source,
    semantics: { nativeElements: [], derived: false },
    interactivity: { focusable: false, handlers: [] },
    accessibleNameSources: [],
    ariaProps: [],
    stateProps: [],
    runtimeAnalysisRequired: true,
  };
}

function validateSelection(options: BuildLintReportOptions, model: CanonicalComponentModel): ReadonlySet<string> | undefined {
  if (options.stateIds !== undefined || options.checkIds !== undefined) {
    throw new LintSelectionError("State/check ID selection is declared but not supported by RFC-009 execution; select canonical component IDs instead.");
  }
  if (options.componentIds === undefined) return undefined;
  const known = new Set(model.components.map((component) => component.id));
  const unknown = options.componentIds.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new LintSelectionError(`Unknown canonical component ID${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
  return new Set(options.componentIds);
}

function snapshotRules(rules: ResolvedConfig["rules"]): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(rules).map(([id, value]) => [id, Array.isArray(value) ? value[0] : value]));
}

/**
 * Diagnostic for a run that did not complete for reasons outside any single
 * check (cancellation, or a genuinely unrecoverable orchestration/runtime
 * failure such as a browser that never launches). A typed `LanternError`
 * raised here keeps its own `code` instead of being flattened to a generic
 * "OPERATIONAL_ERROR" — recoverable per-check failures never reach this
 * function; see `executePlannedChecks` and the check-level diagnostic built
 * alongside `outcomeReason: "operational-error"` in `buildComponentReport`.
 */
function operationalDiagnostic(error: unknown, cancelled: boolean): LintDiagnostic {
  if (cancelled) {
    return { code: "AUDIT_CANCELLED", severity: "warning", scope: "run", source: "lantern", message: error instanceof Error ? error.message : String(error) };
  }
  if (error instanceof LanternError) {
    return { code: error.code, severity: "error", scope: "run", source: "lantern", message: error.message };
  }
  return { code: "OPERATIONAL_ERROR", severity: "error", scope: "run", source: "lantern", message: error instanceof Error ? error.message : String(error) };
}

function failedReport(
  options: BuildLintReportOptions,
  runId: string,
  startedAt: string,
  finishedAt: string,
  cancelled: boolean,
  diagnostic: LintDiagnostic,
  componentReports: readonly ComponentReport[] = [],
  extraDiagnostics: readonly LintDiagnostic[] = [],
): LintReport {
  const ruleStandards = ruleStandardsIndex();
  return {
    version: 3,
    runId,
    startedAt,
    finishedAt,
    status: cancelled ? "cancelled" : "failed",
    generatedAt: startedAt,
    targeting: { mode: options.mode, rescanned: false },
    provider: { kind: "unavailable", reason: "Audit did not complete." },
    engines: [],
    config: { standards: options.config.standards, rules: snapshotRules(options.config.rules) },
    diagnostics: [...extraDiagnostics, diagnostic],
    standards: options.config.standards.map((standard) => ({
      standard,
      components: componentsForStandard(componentReports, standard, ruleStandards),
    })),
    summary: summarizePlanning(componentReports, Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt))),
  };
}

/**
 * Summarize component state-planning outcomes and their real check results
 * (RFC-006/007/008).
 *
 * This is explicitly *not* a per-standard evaluation summary: it is computed
 * once from `componentReports` — the single, standard-independent planning
 * and execution pass reused by every configured standard (see
 * {@link buildLintReport}) — rather than from any one `StandardReport`. All
 * currently known rules (see `rule-registry.ts`) map to every standard, so
 * the totals are representative today; per-standard summaries remain future
 * work once rules with narrower standard mappings exist.
 */
function summarizePlanning(componentReports: readonly ComponentReport[], durationMs: number): LintSummary {
  const summary: {
    componentsPass: number;
    componentsFail: number;
    componentsReview: number;
    componentsSkipped: number;
    checksPass: number;
    checksFail: number;
    checksReview: number;
  } = {
    componentsPass: 0,
    componentsFail: 0,
    componentsReview: 0,
    componentsSkipped: 0,
    checksPass: 0,
    checksFail: 0,
    checksReview: 0,
  };

  for (const component of componentReports) {
    switch (component.status) {
      case "pass":
        summary.componentsPass += 1;
        break;
      case "fail":
        summary.componentsFail += 1;
        break;
      case "review":
        summary.componentsReview += 1;
        break;
      case "skipped":
        summary.componentsSkipped += 1;
        break;
    }
    for (const state of component.states) {
      for (const check of state.checks) {
        if (check.status === "pass") {
          summary.checksPass += 1;
        } else if (check.status === "fail") {
          summary.checksFail += 1;
        } else {
          summary.checksReview += 1;
        }
      }
    }
  }

  return { ...summary, durationMs };
}
