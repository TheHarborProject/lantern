import { KNOWN_STANDARDS, type Standard } from "../schemas/standards.js";
import type { Severity } from "../schemas/rules.js";
import type { GeneratedState } from "../state-planning/types.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import type { EngineCapability, PlannedCheck } from "./types.js";

export interface RulePlanInput {
  readonly component: CanonicalComponent;
  readonly accessibility: AccessibilityComponent;
  readonly states: readonly GeneratedState[];
  readonly severity: Exclude<Severity, "off">;
}

/**
 * Lantern-owned rule metadata (RFC-008): plans zero or more engine-independent
 * checks for a component, and records which configured standards the rule
 * maps to. `plan` never touches an engine — capability matching (see
 * `match-engine.ts`) decides which engine, if any, executes each check.
 */
export interface LanternRuleDefinition {
  readonly ruleId: string;
  readonly requiredCapability: EngineCapability;
  /** Standards (RFC-005 evaluation contexts) this rule's evidence maps to. */
  readonly standards: readonly Standard[];
  readonly plan: (input: RulePlanInput) => readonly PlannedCheck[];
}

const ALL_STANDARDS: readonly Standard[] = KNOWN_STANDARDS;

/**
 * One planned check per generated state, sharing the same evidence and
 * `requiredCapability`. Keeps the state-nested report shape (RFC-007) as the
 * single place every check lives, whether or not its outcome actually varies
 * by state.
 */
function planPerState(
  ruleId: string,
  requiredCapability: EngineCapability,
  input: RulePlanInput,
): readonly PlannedCheck[] {
  return input.states.map((state) => ({
    ruleId,
    severity: input.severity,
    componentId: input.component.id,
    component: input.component.name,
    source: input.component.source,
    requiredCapability,
    stateId: state.id,
    stateProps: state.props,
    accessibility: input.accessibility,
  }));
}

/**
 * Genuine static rule (RFC-008): flags a focusable/interactive component that
 * exposes no prop capable of establishing an accessible name at all — a real
 * defect provable from the existing accessibility projection (RFC-004),
 * without rendering. Evaluated by {@link createStaticEngine}.
 */
const accessibleNameRule: LanternRuleDefinition = {
  ruleId: "lantern/accessible-name",
  requiredCapability: "static-evidence",
  standards: ALL_STANDARDS,
  plan(input) {
    if (!input.accessibility.interactivity.focusable) {
      return [];
    }
    return planPerState("lantern/accessible-name", "static-evidence", input);
  },
};

/**
 * Genuine rendered rule (RFC-008): mounts a focusable/interactive component
 * through the RFC-007.5 session runtime and verifies that the rendered output
 * participates in (or, when disabled, is excluded from) the sequential
 * keyboard focus order — evidence no static scan can provide. Evaluated by
 * {@link createRenderedDomEngine}.
 */
const keyboardAccessRule: LanternRuleDefinition = {
  ruleId: "lantern/keyboard-access",
  requiredCapability: "rendered-dom",
  standards: ALL_STANDARDS,
  plan(input) {
    if (!input.accessibility.interactivity.focusable) {
      return [];
    }
    return planPerState("lantern/keyboard-access", "rendered-dom", input);
  },
};

/**
 * Configured but not yet implemented by any engine (RFC-008 scope: prove the
 * abstraction with the smallest genuine engine set, not the full
 * `lantern:recommended` catalog). Still planned so an enabled rule with no
 * supporting engine surfaces truthfully as `review` instead of vanishing
 * silently — see the acceptance criterion "unsupported checks cannot become
 * passes".
 */
const colorContrastRule: LanternRuleDefinition = {
  ruleId: "lantern/color-contrast",
  requiredCapability: "rendered-dom",
  standards: ALL_STANDARDS,
  plan(input) {
    return planPerState("lantern/color-contrast", "rendered-dom", input);
  },
};

const focusVisibleRule: LanternRuleDefinition = {
  ruleId: "lantern/focus-visible",
  requiredCapability: "rendered-dom",
  standards: ALL_STANDARDS,
  plan(input) {
    if (!input.accessibility.interactivity.focusable) {
      return [];
    }
    return planPerState("lantern/focus-visible", "rendered-dom", input);
  },
};

/** The known Lantern rule catalog (RFC-008). Deliberately small — see RFC-008's non-goals. */
export const LANTERN_RULES: readonly LanternRuleDefinition[] = [
  accessibleNameRule,
  keyboardAccessRule,
  colorContrastRule,
  focusVisibleRule,
];

/** Standards each known rule maps to, indexed for report assembly (RFC-008). */
export function ruleStandardsIndex(): ReadonlyMap<string, ReadonlySet<Standard>> {
  return new Map(LANTERN_RULES.map((rule) => [rule.ruleId, new Set(rule.standards)]));
}
