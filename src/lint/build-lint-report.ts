import { resolve } from "node:path";
import type { Browser } from "playwright";
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
  const { config, mode, maxStates = DEFAULT_MAX_STATES, cwd } = options;
  const startedAt = Date.now();

  const targets = resolveLintTargets({ root: config.project.root, cwd, ignorePatterns: config.ignorePatterns, mode });
  const accessibilityById = indexAccessibility(targets.model);
  const includedComponents = filterComponents(targets.model, targets.targetComponentIds);
  const configResolution = resolveComponentConfigs(includedComponents, config);

  const engines = createEnabledEngines(config.engines);
  const session = createLintExecutionSession({
    projectRoot: config.project.root,
    globals: resolveIsolationGlobals(config.project.root, config.isolation),
    mountTimeoutMs: options.mountTimeoutMs,
    bundle: options.bundle,
    launch: options.launch,
  });

  let componentReports: ComponentReport[];
  try {
    componentReports = [];
    // Sequential by design (RFC-008 defers concurrency): normalized result
    // ordering must never depend on browser/engine completion order.
    for (const component of includedComponents) {
      const report = await buildComponentReport(
        component,
        accessibilityById,
        config,
        maxStates,
        configResolution.configsById,
        engines,
        session,
      );
      componentReports.push(report);
    }
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

  return {
    version: 2,
    generatedAt: new Date(startedAt).toISOString(),
    targeting: { mode, rescanned: targets.rescanned, selection: targets.selection },
    provider: describeProvider(engines),
    diagnostics: [
      ...targets.model.diagnostics.map((diagnostic): LintDiagnostic => ({
        source: diagnostic.source,
        component: diagnostic.exportName,
        message: diagnostic.message,
      })),
      ...configResolution.diagnostics,
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
  const plannedChecks = planChecksForComponent({ component, accessibility, states: plan.states, activeRules });

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

  const executed = await executePlannedChecks(plannedChecks, engines, () => ({ runtime }));

  const checksByState = new Map<string, CheckResult[]>();
  for (const { check, result } of executed) {
    if (check.stateId === undefined) {
      continue;
    }
    const existing = checksByState.get(check.stateId);
    if (existing === undefined) {
      checksByState.set(check.stateId, [result]);
    } else {
      existing.push(result);
    }
  }

  return toComponentReport(component, plan, maxStates, checksByState);
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
      props: state.props,
      propProvenance: buildProvenance(plan.dimensions),
      checks,
      // "review" whenever nothing was actually verified for this state
      // (empty `checks`): never a fabricated "pass".
      status: aggregateCheckStatus(checks),
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

function buildProvenance(dimensions: readonly ResolvedPropValues[]): StatePropProvenance {
  const provenance: Record<string, ResolvedPropValues["source"]> = {};
  for (const dimension of dimensions) {
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
