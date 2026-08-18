import { confirm, input, select } from "@inquirer/prompts";
import { relative } from "node:path";
import type { Command } from "commander";
import { ConfigAlreadyExistsError } from "../../errors/config-already-exists-error.js";
import { InitError } from "../../errors/init-error.js";
import { LanternError } from "../../errors/lantern-error.js";
import { initProject, type InitPrompter } from "../../init/init-project.js";
import type { GlobalCliOptions } from "../global-cli-options.js";
import { printCliError } from "../print-cli-error.js";

/** Register the deliberately small interactive project initializer. */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a minimal Lantern configuration interactively.")
    .action(async (_options, command: Command) => {
      const globalOptions = command.optsWithGlobals<GlobalCliOptions>();
      console.log("Lantern init\n");

      try {
        const result = await initProject(process.cwd(), createInquirerInitPrompter(), (message) => {
          console.log(`✓ ${message}`);
        });

        if (result.status === "already-configured") {
          console.log("Lantern is already configured for this project.");
          return;
        }
        if (result.status === "cancelled") {
          console.log("Lantern initialization cancelled.");
          return;
        }

        console.log(`\n✓ Created ${relative(process.cwd(), result.configPath)}`);
        console.log("\nRun `lantern survey` to evaluate your components.");
      } catch (error) {
        if (error instanceof ConfigAlreadyExistsError) {
          console.log("Lantern is already configured for this project.");
          return;
        }
        if (isPromptCancellation(error)) {
          console.log("Lantern initialization cancelled.");
          return;
        }
        if (error instanceof LanternError) {
          printCliError(error, globalOptions.debug ?? false);
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    });
}

export function createInquirerInitPrompter(): InitPrompter {
  return {
    async selectStartScript(scripts): Promise<string | undefined> {
      if (process.stdin.isTTY !== true) {
        throw new InitError(
          "Lantern init is interactive, but stdin is not a TTY. Run it in an interactive terminal.",
        );
      }
      return select({
        message: "Which script starts your application?",
        choices: scripts.map((script) => ({ name: script, value: script })),
      });
    },
    async selectSourceDirectory(candidates): Promise<string | undefined> {
      assertInteractiveTerminal();
      const customValue = "__lantern_custom_source__";
      const selection = await select({
        message: "Where should Lantern look for components?",
        choices: [
          ...candidates.map((path) => ({ name: path, value: path })),
          { name: "Project root", value: "." },
          { name: "Custom path...", value: customValue },
        ],
        default: candidates[0] ?? ".",
      });
      if (selection !== customValue) return selection;
      return input({
        message: "Component source path:",
        validate: (value) => value.trim() !== "" || "Enter a project-relative directory path.",
      });
    },
    async selectStandard(standards, defaultStandard): Promise<(typeof standards)[number] | undefined> {
      assertInteractiveTerminal();
      const ordered = [defaultStandard, ...standards.filter((standard) => standard !== defaultStandard)];
      return select({
        message: "Which accessibility standard should Lantern use?",
        choices: ordered.map((standard) => ({
          name: `${standardLabel(standard)}${standard === defaultStandard ? " (recommended)" : ""}`,
          value: standard,
        })),
        default: defaultStandard,
      });
    },
    async selectOutputMode(defaultMode): Promise<"minimal" | "compact" | "verbose" | undefined> {
      assertInteractiveTerminal();
      return select({
        message: "Which lint output mode do you prefer?",
        choices: [
          { name: "Minimal", value: "minimal" as const },
          { name: "Compact (recommended)", value: "compact" as const },
          { name: "Verbose", value: "verbose" as const },
        ],
        default: defaultMode,
      });
    },
    async confirmIgnorePatterns(): Promise<boolean | undefined> {
      assertInteractiveTerminal();
      return confirm({ message: "Add ignore patterns?", default: false });
    },
    async inputIgnorePattern(): Promise<string | undefined> {
      assertInteractiveTerminal();
      return input({
        message: "Ignore pattern:",
        validate: (value) => value.trim() !== "" || "Enter a non-empty glob pattern.",
      });
    },
    async confirmAnotherIgnorePattern(): Promise<boolean | undefined> {
      assertInteractiveTerminal();
      return confirm({ message: "Add another ignore pattern?", default: false });
    },
  };
}

function assertInteractiveTerminal(): void {
  if (process.stdin.isTTY !== true) {
    throw new InitError(
      "Lantern init is interactive, but stdin is not a TTY. Run it in an interactive terminal.",
    );
  }
}

function standardLabel(standard: string): string {
  const match = /^wcag(\d)(\d)-(a|aa)$/.exec(standard);
  if (match !== null) return `WCAG ${match[1]}.${match[2]} ${match[3]?.toUpperCase()}`;
  return standard === "rgaa4.1" ? "RGAA 4.1" : standard;
}

function isPromptCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}
