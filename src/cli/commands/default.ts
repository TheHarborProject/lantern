import { Command } from "commander";
import { SnapRunError } from "../../errors/snaprun-error.js";
import { formatSnapshotReport } from "../../output/format-snapshot-report.js";
import { resolveSnapshotSelection } from "../../snapshots/resolve-snapshot-selection.js";
import { runSnapshots } from "../../snapshots/run-snapshots.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

interface DefaultCommandOptions {
  readonly runName?: string;
  readonly partial?: boolean;
  readonly route?: string;
  readonly user?: string;
}

/**
 * Register the default program action (no subcommand name, RFC-010):
 * capture every run, or a narrower scope depending on the selected options
 * (`--runName`, `--partial`, `--route`, `--user`).
 */
export function registerDefaultCommand(program: Command): void {
  program
    .option("--runName <name>", "Capture only one configured run")
    .option(
      "--partial",
      "Requires --runName. Currently retained for CLI compatibility and does not change route selection.",
    )
    .option("--route <path>", "Capture one configured route by path")
    .option("--user <name>", "Use this user when capturing a route outside a run")
    .action(async (options: DefaultCommandOptions, command: Command) => {
      const { config, debug } = command.optsWithGlobals<GlobalCliOptions>();

      try {
        const selection = resolveSnapshotSelection(options);
        const report = await runSnapshots({
          cwd: process.cwd(),
          explicitConfigPath: config,
          selection,
          onWarning: (message) => console.warn(message),
        });

        console.log(formatSnapshotReport(report));
        process.exitCode = report.succeeded ? 0 : 1;
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
