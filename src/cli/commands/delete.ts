import { confirm } from "@inquirer/prompts";
import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { SurveyHistoryError } from "../../errors/survey-history-error.js";
import { deleteProjectSurveyRun, resolveProjectSurveyRun } from "../../history/service.js";
import type { SurveyRunV1 } from "../../survey/schema/survey-run.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

export type DeleteConfirmation = (run: SurveyRunV1) => Promise<boolean>;

export function registerDeleteCommand(program: Command, confirmation: DeleteConfirmation = defaultConfirmation): void {
  program.command("delete")
    .argument("<id>", "Full survey ID, unique prefix, or last")
    .description("Delete exactly one saved survey.")
    .option("--force", "Delete without interactive confirmation")
    .action(async (selector: string, options: { readonly force?: boolean }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const run = resolveProjectSurveyRun(config, selector);
        if (options.force !== true && !(await confirmation(run))) { console.log("Deletion cancelled."); return; }
        deleteProjectSurveyRun(config, run.id);
        console.log(`Deleted survey ${run.id}.`);
      } catch (error) {
        if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
        throw error;
      }
    });
}

async function defaultConfirmation(run: SurveyRunV1): Promise<boolean> {
  if (process.stdin.isTTY !== true) throw new SurveyHistoryError("io", "Interactive confirmation requires a TTY; use --force for scripts or CI.");
  return confirm({ message: `Delete survey ${run.id}${run.name === undefined ? "" : ` (${run.name})`}?`, default: false });
}
