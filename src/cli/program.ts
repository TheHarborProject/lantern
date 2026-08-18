import { Command } from "commander";
import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "../generated/version.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerSurveyCommand } from "./commands/survey.js";
import { registerListCommand } from "./commands/list-surveys.js";
import { registerShowCommand } from "./commands/show.js";
import { registerExportCommand } from "./commands/export.js";
import { registerDeleteCommand } from "./commands/delete.js";
import type { DeleteConfirmation } from "./commands/delete.js";
import type { SurveyRunSink } from "../survey/persistence.js";
import type { InteractiveSurveyPrompter } from "../interactive/types.js";

export interface CreateProgramOptions {
  readonly deleteConfirmation?: DeleteConfirmation;
  readonly surveySink?: SurveyRunSink;
  readonly interactivePrompter?: InteractiveSurveyPrompter;
  readonly isInteractiveTerminal?: () => boolean;
}

/** Build the Lantern CLI program. */
export function createProgram(options: CreateProgramOptions = {}): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(CLI_DESCRIPTION)
    .version(CLI_VERSION, "-v, --version", "Show the Lantern version")
    .option("--config <path>", "Load a specific configuration file")
    .option("--debug", "Print the full stack trace and original error cause")
    .addHelpText(
      "after",
      `
Examples:
  lantern --help
  lantern --version
  lantern --config ./lantern.config.json
  lantern init
  lantern scan
  lantern scan --all
  lantern survey
  lantern survey --interactive
  lantern survey src/components
  lantern list surveys
  lantern show last
  lantern export last
  lantern delete last
`,
    );

  registerAuditCommand(program);
  registerInitCommand(program);
  registerLintCommand(program);
  registerScanCommand(program);
  registerSurveyCommand(program, { sink: options.surveySink, interactivePrompter: options.interactivePrompter, isInteractiveTerminal: options.isInteractiveTerminal });
  registerListCommand(program);
  registerShowCommand(program);
  registerExportCommand(program);
  registerDeleteCommand(program, options.deleteConfirmation);

  return program;
}
