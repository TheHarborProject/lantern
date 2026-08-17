import { projectAccessibility } from "../component-scan/project-accessibility.js";
import { DEFAULT_MAX_STATES, planComponentState } from "../state-planning/plan-component-state.js";
import type { ComponentStatePlan, ResolvedPropValues } from "../state-planning/types.js";
import type { AccessibilityComponent, CanonicalComponent, CanonicalComponentModel } from "../types/component-scan.js";
import type { ResolvedConfig } from "../types/config.js";
import { resolveLintTargets } from "./resolve-lint-targets.js";
import type {
  ComponentReport,
  LintDiagnostic,
  LintReport,
  LintSummary,
  LintTargetMode,
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
}

/**
 * Orchestrate `lantern lint` (RFC-007): resolve targets (RFC-002/004
 * discovery, reused as-is), plan each targeted component's states (RFC-006,
 * reused as-is — no prop inference happens here), and assemble the structured,
 * engine-agnostic report. No accessibility check is executed or fabricated:
 * every state's `checks` array stays empty until RFC-008 attaches a provider.
 */
export function buildLintReport(options: BuildLintReportOptions): LintReport {
  const { config, mode, maxStates = DEFAULT_MAX_STATES, cwd } = options;
  const startedAt = Date.now();

  const targets = resolveLintTargets({ root: config.project.root, cwd, ignorePatterns: config.ignorePatterns, mode });
  const accessibilityById = indexAccessibility(targets.model);
  const includedComponents = filterComponents(targets.model, targets.targetComponentIds);
  const configResolution = resolveComponentConfigs(includedComponents, config);

  // Component state planning (RFC-006) does not vary by standard — no
  // standard-aware check provider exists yet (RFC-008) — so it is computed
  // once here and reused verbatim for every configured standard's report.
  // Each `StandardReport` still stays a distinct, separately labeled
  // evaluation context (RFC-005): none is treated as more "representative"
  // than another, and none is merged into a synthetic combined result.
  const componentReports = includedComponents.map((component) =>
    buildComponentReport(component, accessibilityById, config, maxStates, configResolution.configsById),
  );

  const standards: StandardReport[] = config.standards.map((standard) => ({
    standard,
    components: componentReports,
  }));

  return {
    version: 2,
    generatedAt: new Date(startedAt).toISOString(),
    targeting: { mode, rescanned: targets.rescanned, selection: targets.selection },
    provider: { kind: "unavailable", reason: "no check provider configured" },
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

function buildComponentReport(
  component: CanonicalComponent,
  accessibilityById: ReadonlyMap<string, AccessibilityComponent>,
  config: ResolvedConfig,
  maxStates: number,
  configsById: ReadonlyMap<string, NonNullable<ResolvedConfig["components"][string]>>,
): ComponentReport {
  const accessibility = accessibilityById.get(component.id) ?? emptyAccessibility(component);
  const componentConfig = configsById.get(component.id);

  const plan = planComponentState({
    component,
    accessibility,
    componentConfig,
    fixtures: config.fixtures,
    maxStates,
  });

  return toComponentReport(component, plan, maxStates);
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

  const states: StateReport[] = plan.states.map((state) => ({
    stateId: state.id,
    props: state.props,
    propProvenance: buildProvenance(plan.dimensions),
    checks: [],
    // No check provider exists yet (RFC-008): a generated state is truthfully
    // "review" (unverified), never a fabricated "pass".
    status: "review",
  }));

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
 * Summarize component state-planning outcomes (RFC-006/007).
 *
 * This is explicitly *not* a per-standard evaluation summary: it is computed
 * once from `componentReports` — the single, standard-independent planning
 * pass reused by every configured standard (see {@link buildLintReport}) —
 * rather than from any one `StandardReport`. It must not be read as "the
 * first/any standard's results are representative"; once RFC-008 makes checks
 * standard-aware, this will need to become per-standard in its own right.
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
