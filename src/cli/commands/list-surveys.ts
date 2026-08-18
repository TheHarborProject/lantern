import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { displaySurveyId, limitSurveyRuns } from "../../history/catalog.js";
import { listProjectSurveyRuns } from "../../history/service.js";
import type { SurveyRunV1 } from "../../survey/schema/survey-run.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

export function registerListCommand(program: Command): void {
  const list = program.command("list").description("List saved project data.");
  list.command("surveys")
    .description("List saved surveys in the current project.")
    .option("--max <count>", "Limit the number of displayed surveys", positiveInteger)
    .action((options: { readonly max?: number }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const complete = listProjectSurveyRuns(config);
        const listing = limitSurveyRuns(complete, options.max ?? config.survey.history.listMax);
        console.log(renderSurveyList(listing.runs, complete.runs));
        for (const problem of listing.problems) console.error(`History ${problem.kind}: ${problem.file}: ${problem.message}`);
        if (listing.problems.length > 0) process.exitCode = 2;
      } catch (error) {
        if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
        throw error;
      }
    });
}

export function renderSurveyList(runs: readonly SurveyRunV1[], allRuns: readonly SurveyRunV1[], now = Date.now()): string {
  const lines = ["Surveys", ""];
  if (runs.length === 0) return "Surveys\n\nNo saved surveys.\n";
  for (const run of runs) {
    const components = run.summary.componentsPass + run.summary.componentsFail + run.summary.componentsReview + run.summary.componentsSkipped;
    const standards = run.standards.map(({ standard }) => standardLabel(standard)).join(", ") || "No standards";
    const name = run.name === undefined ? "" : `  ${run.name}`;
    lines.push(`${displaySurveyId(run, allRuns)}  ${formatAge(run.startedAt, now).padEnd(10)}  ${standards}  ${components} components  ${run.summary.componentsFail} failed  ${run.status}${name}`);
  }
  return `${lines.join("\n")}\n`;
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--max must be a positive integer.");
  return parsed;
}

function formatAge(startedAt: string, now: number): string {
  const elapsed = Math.max(0, now - Date.parse(startedAt));
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function standardLabel(id: string): string {
  return ({ "wcag22-aa": "WCAG 2.2 AA", "wcag21-aa": "WCAG 2.1 AA", "rgaa4.1": "RGAA 4.1" } as Readonly<Record<string, string>>)[id] ?? id;
}
