import type { ComponentConfig } from "../schemas/components.js";
import type { FixturesConfig } from "../schemas/fixtures.js";
import type { AccessibilityComponent, CanonicalComponent } from "../types/component-scan.js";
import { computeStateId } from "./compute-state-id.js";
import { generateBoundedCombinations } from "./generate-combinations.js";
import { resolvePropValues } from "./resolve-prop-values.js";
import type { ComponentStatePlan, GeneratedState, ResolvedPropValues, UnresolvedProp } from "./types.js";

/**
 * Default upper bound on generated states per component (RFC-006). Chosen to
 * keep planning bounded and fast without needing configuration for the common
 * case; callers may override it via {@link PlanComponentStateInput.maxStates}.
 */
export const DEFAULT_MAX_STATES = 50;

export interface PlanComponentStateInput {
  readonly component: CanonicalComponent;
  readonly accessibility: AccessibilityComponent;
  /** Resolved `components.<name>` entry for this component, if configured. */
  readonly componentConfig?: ComponentConfig | undefined;
  /** Resolved central `fixtures` map (RFC-006). */
  readonly fixtures?: FixturesConfig | undefined;
  readonly maxStates?: number | undefined;
}

/**
 * Turn one discovered component into a deterministic, bounded plan of
 * renderable prop combinations (RFC-006).
 *
 * - `skip` (explicit user configuration) short-circuits to `"skipped"` — a
 *   deliberate opt-out, not an error.
 * - Any required prop that cannot be resolved (explicit config, fixture, or
 *   safe inference) short-circuits to `"unresolved"` with structured,
 *   actionable detail; nothing is invented, and the pipeline never throws.
 * - Otherwise `"ready"`: props resolved to exactly one value apply to every
 *   generated state; props resolved to more than one value become branching
 *   dimensions, combined deterministically up to `maxStates`.
 */
export function planComponentState(input: PlanComponentStateInput): ComponentStatePlan {
  const { component, accessibility, componentConfig, fixtures = {}, maxStates = DEFAULT_MAX_STATES } = input;

  if (componentConfig?.skip === true) {
    return { status: "skipped", component: component.name, componentId: component.id };
  }

  const unresolvedProps: UnresolvedProp[] = [];
  const resolvedProps: ResolvedPropValues[] = [];

  for (const prop of component.props) {
    const resolution = resolvePropValues(prop, { componentConfig, fixtures, accessibility });
    if (resolution.status === "resolved") {
      resolvedProps.push(resolution.plan);
    } else if (resolution.status === "unresolved") {
      unresolvedProps.push({ name: prop.name, type: prop.type, reason: resolution.reason });
    }
    // "omitted": the component's own default applies; nothing to record.
  }

  if (unresolvedProps.length > 0) {
    return { status: "unresolved", component: component.name, componentId: component.id, unresolvedProps };
  }

  const fixedProps = resolvedProps.filter((resolved) => resolved.values.length === 1 || !resolved.stateDimension);
  const dimensionProps = resolvedProps.filter((resolved) => resolved.values.length > 1 && resolved.stateDimension);

  const { combinations, totalPossible, truncated } = generateBoundedCombinations(
    dimensionProps.map((dimension) => dimension.values),
    maxStates,
  );

  const states: GeneratedState[] = combinations.map((combination) => {
    const props: Record<string, unknown> = {};
    for (const fixed of fixedProps) {
      props[fixed.name] = fixed.values[0];
    }
    dimensionProps.forEach((dimension, index) => {
      props[dimension.name] = combination[index];
    });

    return {
      id: computeStateId(component.id, props),
      component: component.name,
      componentId: component.id,
      props,
    };
  });

  return {
    status: "ready",
    component: component.name,
    componentId: component.id,
    dimensions: dimensionProps,
    fixedProps,
    states,
    totalPossibleStates: totalPossible,
    truncated,
    maxStates,
  };
}
