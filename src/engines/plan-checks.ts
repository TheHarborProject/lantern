import type { GeneratedState } from "../state-planning/types.js";
import type { Severity } from "../schemas/rules.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import { LANTERN_RULES } from "./rule-registry.js";
import type { PlannedCheck } from "./types.js";

export interface PlanChecksInput {
  readonly component: CanonicalComponent;
  readonly accessibility: AccessibilityComponent;
  readonly states: readonly GeneratedState[];
  readonly activeRules: ReadonlyMap<string, Exclude<Severity, "off">>;
}

/**
 * Plan every applicable check for one component (RFC-008), independent of
 * which engine — if any — ends up executing it. Iterates the fixed
 * {@link LANTERN_RULES} catalog in declared order and only plans a rule the
 * project actually configured (severity `off` or absent never reaches this
 * point — see `resolveActiveRules`), so a component with no active rules
 * produces no checks and never touches an engine.
 */
export function planChecksForComponent(input: PlanChecksInput): readonly PlannedCheck[] {
  const checks: PlannedCheck[] = [];
  for (const rule of LANTERN_RULES) {
    const severity = input.activeRules.get(rule.ruleId);
    if (severity === undefined) {
      continue;
    }
    checks.push(
      ...rule.plan({
        component: input.component,
        accessibility: input.accessibility,
        states: input.states,
        severity,
      }),
    );
  }
  return checks;
}
