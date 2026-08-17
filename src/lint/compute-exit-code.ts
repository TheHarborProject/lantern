import type { LintReport } from "./types.js";

export interface ComputeExitCodeOptions {
  /** `--fail-on-skipped`: unresolved/explicitly-skipped components become blocking. */
  readonly failOnSkipped: boolean;
}

/**
 * Deterministic CI-friendly exit-code semantics for a successfully produced
 * report (RFC-007). `2` (Lantern/configuration/runtime failure) is not
 * computed here: it is only ever produced when the pipeline throws, at the
 * CLI boundary, before a report exists at all.
 *
 * - a `fail` check whose configured severity is `error` blocks (`1`);
 * - a `fail` check whose configured severity is `warn` alone does not;
 * - `review` alone does not block;
 * - `skipped`/`unresolved` components block only with `--fail-on-skipped`.
 */
export function computeExitCode(report: LintReport, options: ComputeExitCodeOptions): 0 | 1 {
  if (options.failOnSkipped && (report.diagnostics ?? []).length > 0) {
    return 1;
  }
  for (const standard of report.standards) {
    for (const component of standard.components) {
      if (options.failOnSkipped && component.status === "skipped") {
        return 1;
      }
      for (const state of component.states) {
        for (const check of state.checks) {
          if (check.status === "fail" && check.severity === "error") {
            return 1;
          }
        }
      }
    }
  }
  return 0;
}
