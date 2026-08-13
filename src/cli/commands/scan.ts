import { Command, Option } from "commander";
import { formatScanSummary } from "../../output/format-scan-summary.js";
import { runScan } from "../../scan/run-scan.js";
import { SnapRunError } from "../../errors/snaprun-error.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

interface ScanCommandOptions {
  readonly default: "enabled" | "disabled";
}

/** Register `snaprun scan` on the CLI program (RFC-006). */
export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Discover Next.js routes and update the SnapRun configuration file.")
    .addOption(
      new Option("--default <mode>", "Set enableSnapshot for newly discovered routes")
        .choices(["enabled", "disabled"])
        .default("disabled"),
    )
    .action(async (options: ScanCommandOptions, command: Command) => {
      const { config, debug } = command.optsWithGlobals<GlobalCliOptions>();

      try {
        const result = await runScan({
          cwd: process.cwd(),
          explicitConfigPath: config,
          defaultEnableSnapshot: options.default === "enabled",
          onWarning: (message) => console.warn(message),
        });

        console.log(formatScanSummary(result));
      } catch (error) {
        if (error instanceof SnapRunError) {
          printCliError(error, debug === true);
          process.exitCode = 1;
          return;
        }

        throw error;
      }
    });
}
