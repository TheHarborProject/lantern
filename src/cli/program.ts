import { Command } from "commander";
import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "../generated/version.js";
import { registerDefaultCommand } from "./commands/default.js";
import { registerInitCommand } from "./commands/init.js";
import { registerScanCommand } from "./commands/scan.js";

/** Build the SnapRun CLI program. */
export function createProgram(): Command {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description(CLI_DESCRIPTION)
    .version(CLI_VERSION, "-v, --version", "Show the SnapRun version")
    .option("--config <path>", "Load a specific configuration file")
    .option("--debug", "Print the full stack trace and original error cause")
    .addHelpText(
      "after",
      `
Examples:
  snaprun
  snaprun --config ./snaprun.config.json
  snaprun --runName smoke
  snaprun --route /account
  snaprun scan
  snaprun init
`,
    );

  registerDefaultCommand(program);
  registerScanCommand(program);
  registerInitCommand(program);

  return program;
}
