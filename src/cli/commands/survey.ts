import type { Command } from "commander";
import { loadConfig } from "../../config/load-config.js";
import { LanternError } from "../../errors/lantern-error.js";
import { LintTargetingError } from "../../errors/lint-targeting-error.js";
import type { OutputMode } from "../../schemas/output.js";
import { computeSurveyExitCode } from "../../survey/compute-survey-exit-code.js";
import { deliverSurveyRun, shouldPersistSurveyRun, type SurveyRunSink } from "../../survey/persistence.js";
import { renderSurveyRun } from "../../survey/render-survey-run.js";
import { runSurvey, type SurveySelectionRequest } from "../../survey/run-survey.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";
import { shouldUseColor } from "../terminal-style.js";
import { createSurveyHistorySink } from "../../history/service.js";
import { SurveyHistoryError } from "../../errors/survey-history-error.js";
import { InteractiveSurveyError } from "../../errors/interactive-survey-error.js";
import { createTerminalSurveyPrompter } from "../../interactive/terminal-prompter.js";
import { prepareInteractiveSurvey } from "../../interactive/workflow.js";
import type { InteractiveSurveyPrompter } from "../../interactive/types.js";

export interface SurveyCommandOptions {
  readonly since?: string; readonly name?: string; readonly save?: boolean;
  readonly interactive?: boolean;
  readonly verbose?: boolean; readonly minimal?: boolean; readonly compact?: boolean; readonly failOnSkipped?: boolean;
}

export interface SurveyCommandDependencies {
  readonly sink?: SurveyRunSink | undefined;
  readonly interactivePrompter?: InteractiveSurveyPrompter | undefined;
  readonly isInteractiveTerminal?: (() => boolean) | undefined;
}

export function registerSurveyCommand(program: Command, dependencies: SurveyCommandDependencies = {}): void {
  program.command("survey")
    .argument("[path]", "Limit the survey to components sourced from a file or directory")
    .description("Evaluate accessibility across an explicit component selection.")
    .option("-i, --interactive", "Select components and states interactively before surveying")
    .option("--since <ref>", "Target components changed since the given Git ref")
    .option("--name <name>", "Attach an optional name to this immutable survey run")
    .option("--no-save", "Do not deliver this run to the configured persistence sink")
    .option("--verbose", "Show diagnostics, state props, provenance, and evidence")
    .option("--minimal", "Show only the final summary")
    .option("--compact", "Show scannable per-component output")
    .option("--fail-on-skipped", "Exit 1 when any component is skipped or unresolved")
    .action(async (path: string | undefined, options: SurveyCommandOptions, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      try {
        if (path !== undefined && options.since !== undefined) throw new LintTargetingError("Cannot combine an explicit path target with --since.");
        if (options.interactive === true && (path !== undefined || options.since !== undefined)) throw new InteractiveSurveyError("Interactive survey cannot be combined with a path target or --since.");
        const config = loadConfig({ cwd: process.cwd(), explicitPath: globalOptions.config });
        const name = options.name?.trim();
        if (options.name !== undefined && name === "") throw new LintTargetingError("--name must not be empty.");
        const save = shouldPersistSurveyRun({ noSave: options.save === false, ci: process.env.CI !== undefined, localEnabled: config.survey.persistence.local, ciEnabled: config.survey.persistence.ci });
        let run;
        if (options.interactive === true) {
          const interactiveTerminal = dependencies.isInteractiveTerminal?.() ?? (process.stdin.isTTY === true && process.stdout.isTTY === true);
          if (!interactiveTerminal) throw new InteractiveSurveyError("Interactive survey requires an interactive stdin and stdout terminal.");
          const prepared = await prepareInteractiveSurvey({ config, prompter: dependencies.interactivePrompter ?? createTerminalSurveyPrompter(), save });
          if (prepared === null) { console.log("Interactive survey cancelled before execution; no SurveyRun was created."); return; }
          const stateIds = prepared.selection.states.kind === "restricted" ? prepared.selection.states.ids : undefined;
          run = await runSurvey({
            config,
            selection: { kind: "interactive", componentIds: prepared.selection.componentIds, ...(stateIds === undefined ? {} : { stateIds }) },
            preparedScan: prepared.resolvedScan.scan,
            scanPolicyOverride: prepared.resolvedScan.effectivePolicy,
            ...(name === undefined ? {} : { name }), cwd: process.cwd(),
          });
        } else {
          const selection: SurveySelectionRequest = path !== undefined ? { kind: "path", path } : options.since !== undefined ? { kind: "since", ref: options.since } : { kind: "all" };
          run = await runSurvey({ config, selection, ...(name === undefined ? {} : { name }), cwd: process.cwd() });
        }
        try {
          await deliverSurveyRun(run, dependencies.sink ?? createSurveyHistorySink(config), save);
        } catch (cause) {
          if (cause instanceof LanternError) throw cause;
          throw new SurveyHistoryError("io", `Could not persist finalized survey ${run.id}.`, { cause });
        }
        const mode = resolveSurveyOutputMode(options, config.output.mode);
        console.log(renderSurveyRun(run, { mode, color: shouldUseColor(process.stdout.isTTY === true) }));
        process.exitCode = computeSurveyExitCode(run, { failOnSkipped: options.failOnSkipped === true });
      } catch (error) {
        if (error instanceof LanternError) { printCliError(error, globalOptions.debug ?? false); process.exitCode = 2; return; }
        throw error;
      }
    });
}

export function resolveSurveyOutputMode(options: Pick<SurveyCommandOptions, "minimal" | "compact" | "verbose">, configured: OutputMode): OutputMode {
  const modes = [options.minimal ? "minimal" : undefined, options.compact ? "compact" : undefined, options.verbose ? "verbose" : undefined].filter((mode): mode is OutputMode => mode !== undefined);
  if (modes.length > 1) throw new LintTargetingError('"--minimal", "--compact", and "--verbose" are mutually exclusive.');
  return modes[0] ?? configured;
}
