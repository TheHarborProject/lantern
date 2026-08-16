import type { ComponentConfig } from "../schemas/components.js";
import type { FixturesConfig } from "../schemas/fixtures.js";
import type { AccessibilityComponent, ResolvedComponentProp } from "../types/component-scan.js";
import { inferPropType } from "./infer-prop-type.js";
import { isAccessibilityRelevantPropName } from "./is-accessibility-relevant-prop.js";
import type { ResolvedPropValues } from "./types.js";

export interface PropResolutionContext {
  readonly componentConfig: ComponentConfig | undefined;
  readonly fixtures: FixturesConfig;
  readonly accessibility: AccessibilityComponent;
}

export type PropResolution =
  | { readonly status: "resolved"; readonly plan: ResolvedPropValues }
  /** Optional and nothing resolvable: the component's own default applies, silently. */
  | { readonly status: "omitted" }
  | { readonly status: "unresolved"; readonly reason: string };

/**
 * Resolve one prop's value set, in RFC-006's deterministic precedence:
 *
 *   1. explicit inline `values` from configuration — always wins;
 *   2. a configured `fixture` reference, resolved against the central
 *      `fixtures` map;
 *   3. safe automatic inference (booleans, finite literal unions) — attempted
 *      unconditionally for required props (a required prop must be resolved or
 *      reported), but only for optional props already identified as an
 *      accessibility-relevant dimension or owned by the component itself, so
 *      inherited DOM/React noise is never blindly expanded;
 *   4. otherwise: `"omitted"` for an optional prop (the component's default
 *      applies), or `"unresolved"` for a required prop — Lantern never invents
 *      a value for an open-ended/domain type.
 */
export function resolvePropValues(
  prop: ResolvedComponentProp,
  context: PropResolutionContext,
): PropResolution {
  const propConfig = context.componentConfig?.props?.[prop.name];

  if (propConfig?.values !== undefined) {
    if (propConfig.values.length === 0) {
      return prop.required
        ? { status: "unresolved", reason: `Configured "values" for "${prop.name}" is empty.` }
        : { status: "omitted" };
    }
    return {
      status: "resolved",
      plan: { name: prop.name, required: prop.required, source: "explicit", values: propConfig.values },
    };
  }

  if (propConfig?.fixture !== undefined) {
    const fixtureValues = context.fixtures[propConfig.fixture];
    if (fixtureValues === undefined) {
      return {
        status: "unresolved",
        reason: `Prop "${prop.name}" references unknown fixture "${propConfig.fixture}".`,
      };
    }
    if (fixtureValues.length === 0) {
      return prop.required
        ? { status: "unresolved", reason: `Fixture "${propConfig.fixture}" for "${prop.name}" is empty.` }
        : { status: "omitted" };
    }
    return {
      status: "resolved",
      plan: { name: prop.name, required: prop.required, source: "fixture", values: fixtureValues },
    };
  }

  const eligibleForInference =
    prop.required ||
    isAccessibilityRelevantPropName(prop.name, context.accessibility) ||
    prop.origin === "declared";

  if (eligibleForInference) {
    const inferred = inferPropType(prop.type);
    if (inferred.kind === "boolean") {
      return {
        status: "resolved",
        plan: { name: prop.name, required: prop.required, source: "inferred", values: [false, true] },
      };
    }
    if (inferred.kind === "literal-union") {
      return {
        status: "resolved",
        plan: { name: prop.name, required: prop.required, source: "inferred", values: inferred.values },
      };
    }
  }

  if (prop.required) {
    return {
      status: "unresolved",
      reason: `No explicit value, fixture, or safe inference is available for required prop "${prop.name}": ${prop.type}.`,
    };
  }
  return { status: "omitted" };
}
