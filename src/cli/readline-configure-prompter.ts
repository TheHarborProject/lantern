import type { Interface as ReadlineInterface } from "node:readline/promises";
import type { ConfigurePrompter, PromptedAction } from "../lint/run-configure-workflow.js";

const ACTION_MENU: ReadonlyArray<{ readonly key: string; readonly action: PromptedAction; readonly label: string }> = [
  { key: "1", action: "values", label: "Provide explicit values" },
  { key: "2", action: "fixture", label: "Reference a fixture" },
  { key: "3", action: "placeholder", label: "Leave a placeholder (resolve later)" },
  { key: "4", action: "skip-component", label: "Skip this component" },
  { key: "5", action: "leave-unresolved", label: "Leave unresolved for now" },
];

/**
 * Thin `--configure` terminal adapter (RFC-007) over a Node `readline`
 * interface. Only asks questions and parses answers; every write still goes
 * through RFC-006's pure configuration functions via `runConfigureWorkflow`.
 */
export function createReadlineConfigurePrompter(readline: ReadlineInterface): ConfigurePrompter {
  return {
    async selectAction(component, prop): Promise<PromptedAction> {
      console.log(`\n${component} → ${prop.name}: ${prop.type}`);
      console.log(`  ${prop.reason}`);
      for (const entry of ACTION_MENU) {
        console.log(`  ${entry.key}) ${entry.label}`);
      }
      const answer = (await readline.question("Choice [5]: ")).trim();
      const selected = ACTION_MENU.find((entry) => entry.key === answer);
      return selected?.action ?? "leave-unresolved";
    },

    async promptValues(_component, prop): Promise<readonly unknown[]> {
      const answer = await readline.question(`Values for "${prop.name}" (comma-separated): `);
      return splitList(answer);
    },

    async promptFixtureName(_component, prop): Promise<string> {
      const answer = await readline.question(`Fixture name for "${prop.name}": `);
      return answer.trim();
    },

    async promptFixtureValues(fixtureName): Promise<readonly unknown[] | undefined> {
      const answer = await readline.question(
        `Values for fixture "${fixtureName}" (comma-separated, blank to reuse an existing fixture): `,
      );
      const trimmed = answer.trim();
      return trimmed.length === 0 ? undefined : splitList(trimmed);
    },

    notify(message: string): void {
      console.log(message);
    },
  };
}

function splitList(answer: string): string[] {
  return answer
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
