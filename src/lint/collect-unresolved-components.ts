import type { UnresolvedProp } from "../state-planning/types.js";
import type { LintReport } from "./types.js";

export interface UnresolvedComponent {
  readonly component: string;
  readonly unresolvedProps: readonly UnresolvedProp[];
}

/**
 * Collect every component reported as `unresolved`, deduplicated by
 * component name (RFC-007).
 *
 * A component's state plan is standard-independent (no standard-aware checks
 * exist yet), so the same component appears once per configured standard in
 * {@link LintReport.standards}; `--configure` must only prompt for it once.
 */
export function collectUnresolvedComponents(report: LintReport): readonly UnresolvedComponent[] {
  const byName = new Map<string, UnresolvedComponent>();

  for (const standard of report.standards) {
    for (const component of standard.components) {
      if (component.planStatus === "unresolved" && !byName.has(component.component)) {
        byName.set(component.component, {
          component: component.component,
          unresolvedProps: component.unresolvedProps ?? [],
        });
      }
    }
  }

  return [...byName.values()];
}
