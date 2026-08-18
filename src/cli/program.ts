import { Command } from "commander";
import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "../generated/version.js";
import { registerAuditCommand } from "./commands/audit.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerScanCommand } from "./commands/scan.js";
import { registerSurveyCommand } from "./commands/survey.js";

/** Build the Lantern CLI program. */
export function createProgram(): Command {
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
  lantern survey src/components
`,
    );

  registerAuditCommand(program);
  registerInitCommand(program);
  registerLintCommand(program);
  registerScanCommand(program);
  registerSurveyCommand(program);

  return program;
}
