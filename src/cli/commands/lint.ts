import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import { buildLintReport } from "../../lint/build-lint-report.js";
import { collectUnresolvedComponents } from "../../lint/collect-unresolved-components.js";
import { computeExitCode } from "../../lint/compute-exit-code.js";
import { renderLintReport } from "../../lint/render-lint-report.js";
import { runConfigureWorkflow } from "../../lint/run-configure-workflow.js";
import type { LintReport, LintTargetMode } from "../../lint/types.js";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { LintConfigureError } from "../../errors/lint-configure-error.js";
import { LintTargetingError } from "../../errors/lint-targeting-error.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";
import { createReadlineConfigurePrompter } from "../readline-configure-prompter.js";

interface LintCommandOptions {
  readonly all?: boolean;
  readonly since?: string;
  readonly verbose?: boolean;
  readonly configure?: boolean;
  readonly failOnSkipped?: boolean;
}

/** Register `lantern lint` (RFC-007): the normal developer-facing accessibility workflow. */
export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .argument("[path]", "Limit linting to components sourced from a file or directory")
    .description("Run Lantern's accessibility lint workflow across discovered components.")
    .option("--all", "Process every discovered component, forcing a full rescan")
    .option("--since <ref>", "Target components changed since the given Git ref")
    .option("--verbose", "Show additional provenance (state id, rule config, evidence)")
    .option("--configure", "Interactively resolve unresolved component props")
    .option("--fail-on-skipped", "Exit 1 when any component is skipped or unresolved")
    .addHelpText(
      "after",
      `
Examples:
  lantern lint
  lantern lint src/components
  lantern lint --all
  lantern lint --since origin/main
  lantern lint --verbose
  lantern lint --configure
  lantern lint --fail-on-skipped
`,
    )
    .action(async (targetPath: string | undefined, options: LintCommandOptions, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        const mode = resolveTargetMode(options, targetPath);
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const report = await buildLintReport({ config, mode, cwd: process.cwd() });

        if (report.status === "failed" || report.status === "cancelled") {
          for (const diagnostic of report.diagnostics ?? []) {
            console.error(`Error: ${diagnostic.message}`);
          }
          process.exitCode = 2;
          return;
        }

        if (options.configure === true) {
          await runConfigure(config.configFilePath, report);
          return;
        }

        console.log(renderLintReport(report, { verbose: options.verbose === true }));
        process.exitCode = computeExitCode(report, { failOnSkipped: options.failOnSkipped === true });
      } catch (error) {
        if (error instanceof LanternError) {
          printCliError(error, globalOptions.debug ?? false);
          process.exitCode = 2;
          return;
        }
        throw error;
      }
    });
}

function resolveTargetMode(options: LintCommandOptions, targetPath: string | undefined): LintTargetMode {
  if (targetPath !== undefined && options.since !== undefined) {
    throw new LintTargetingError("Cannot combine an explicit path target with --since.");
  }
  if (targetPath !== undefined && options.all === true) {
    throw new LintTargetingError("Cannot combine an explicit path target with --all.");
  }
  if (options.all === true && options.since !== undefined) {
    throw new LintTargetingError('"--all" and "--since" cannot be used together.');
  }
  if (targetPath !== undefined) {
    return { kind: "path", path: targetPath };
  }
  if (options.since !== undefined) {
    return { kind: "since", ref: options.since };
  }
  if (options.all === true) {
    return { kind: "all" };
  }
  return { kind: "incremental" };
}

async function runConfigure(configFilePath: string, report: LintReport): Promise<void> {
  const unresolved = collectUnresolvedComponents(report);
  if (unresolved.length > 0 && process.stdin.isTTY !== true) {
    throw new LintConfigureError(
      '"--configure" resolves unresolved components interactively, but stdin is not a TTY. Run it in an interactive terminal, or edit lantern.config.json directly.',
    );
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await runConfigureWorkflow({
      configFilePath,
      report,
      prompter: createReadlineConfigurePrompter(readline),
    });
  } finally {
    readline.close();
  }
}
