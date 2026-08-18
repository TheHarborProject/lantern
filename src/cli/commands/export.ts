import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { exportSurveyRun, resolveProjectSurveyRun } from "../../history/service.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";
import { SurveyHistoryError } from "../../errors/survey-history-error.js";

export function registerExportCommand(program: Command): void {
  program.command("export")
    .argument("<id>", "Full survey ID, unique prefix, or last")
    .description("Export the canonical saved SurveyRun JSON.")
    .option("--format <format>", "Export format", "json")
    .action((selector: string, options: { readonly format: string }, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        if (options.format !== "json") throw new SurveyHistoryError("io", `Unsupported export format "${options.format}".`);
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        process.stdout.write(exportSurveyRun(resolveProjectSurveyRun(config, selector)));
      } catch (error) {
        if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
        throw error;
      }
    });
}
