import type { SurveyRunV1 } from "./schema/survey-run.js";

export function computeSurveyExitCode(run: SurveyRunV1, options: { readonly failOnSkipped: boolean }): 0 | 1 | 2 {
  if (run.status !== "completed") return 2;
  if (options.failOnSkipped && run.diagnostics.length > 0) return 1;
  for (const standard of run.standards) for (const component of standard.components) {
    if (options.failOnSkipped && component.status === "skipped") return 1;
    for (const state of component.states) for (const check of state.checks) {
      if (check.status === "fail" && check.severity === "error") return 1;
    }
  }
  return 0;
}
