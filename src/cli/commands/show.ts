import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { resolveProjectSurveyRun } from "../../history/service.js";
import { renderSurveyRun } from "../../survey/render-survey-run.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";
import { shouldUseColor } from "../terminal-style.js";
import { resolveSurveyOutputMode, type SurveyCommandOptions } from "./survey.js";

export function registerShowCommand(program: Command): void {
  program.command("show")
    .argument("<id>", "Full survey ID, unique prefix, or last")
    .description("Replay a saved SurveyRun without executing a survey.")
    .option("--verbose", "Show diagnostics, state props, provenance, and evidence")
    .option("--minimal", "Show only the final summary")
    .option("--compact", "Show scannable per-component output")
    .action((selector: string, options: Pick<SurveyCommandOptions, "verbose" | "minimal" | "compact">, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const run = resolveProjectSurveyRun(config, selector);
        const mode = resolveSurveyOutputMode(options, config.output.mode);
        console.log(renderSurveyRun(run, { mode, color: shouldUseColor(process.stdout.isTTY === true) }));
      } catch (error) {
        if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
        throw error;
      }
    });
}
