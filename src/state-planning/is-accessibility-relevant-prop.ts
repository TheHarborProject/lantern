import type { AccessibilityComponent } from "../types/component-scan.js";

/**
 * Whether a prop name was already identified as accessibility-relevant by the
 * accessibility projection (RFC-004) — state props, `aria-*`/`role` props, and
 * accessible-name sources. This reuses that projection instead of inventing a
 * second accessibility-analysis layer (RFC-006).
 *
 * Interaction handlers are deliberately excluded here even though the
 * projection also lists them: generic event handlers never become automatic
 * state dimensions on their own (they still cannot in practice, since a
 * function type is never a safe finite value — see `inferPropType`).
 */
export function isAccessibilityRelevantPropName(
  propName: string,
  accessibility: AccessibilityComponent,
): boolean {
  return (
    accessibility.stateProps.includes(propName) ||
    accessibility.ariaProps.includes(propName) ||
    accessibility.accessibleNameSources.includes(propName)
  );
}
