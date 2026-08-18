import type { OutputMode } from "../schemas/output.js";
import { renderLintReport } from "../lint/render-lint-report.js";
import type { LintReport, LintTargetMode } from "../lint/types.js";
import type { SurveyRunV1 } from "./schema/survey-run.js";

export interface RenderSurveyRunOptions { readonly mode?: OutputMode; readonly color?: boolean }

/** Pure replay renderer: its only factual input is the immutable SurveyRun. */
export function renderSurveyRun(run: SurveyRunV1, options: RenderSurveyRunOptions = {}): string {
  const mode: LintTargetMode = run.targeting.source === "path"
    ? { kind: "path", path: run.targeting.path ?? "." }
    : run.targeting.source === "since"
      ? { kind: "since", ref: run.targeting.ref ?? "" }
      : { kind: "all" };
  const report: LintReport = {
    version: 3, runId: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt,
    status: run.status, generatedAt: run.startedAt,
    targeting: { mode, rescanned: run.targeting.scan.refreshed },
    provider: run.engines.length === 0 ? { kind: "unavailable", reason: "no engines were enabled" } : { kind: "available", provider: run.engines.map((engine) => `${engine.id}@${engine.version}`).join(", ") },
    engines: run.engines, config: { standards: run.config.standards, rules: Object.fromEntries(Object.entries(run.config.rules).map(([id, rule]) => [id, rule.severity])) },
    diagnostics: run.diagnostics, standards: run.standards, summary: run.summary,
  };
  const rendered = renderLintReport(report, { ...options, title: "Lantern survey" });
  if (run.name === undefined || options.mode === "minimal") return rendered;
  return rendered.replace("Lantern survey\n", `Lantern survey\nName  ${run.name}\n`);
}
