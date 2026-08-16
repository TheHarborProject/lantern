import { configurePropResolution, configureSkipComponent } from "../state-planning/configure-unresolved-props.js";
import type { UnresolvedProp } from "../state-planning/types.js";
import { collectUnresolvedComponents } from "./collect-unresolved-components.js";
import type { LintReport } from "./types.js";

/** A human's choice for one unresolved prop, gathered by a {@link ConfigurePrompter}. */
export type PromptedAction = "values" | "fixture" | "placeholder" | "skip-component" | "leave-unresolved";

/**
 * Terminal-adapter boundary for `lantern lint --configure` (RFC-007).
 *
 * This is the only seam between the CLI and RFC-006's pure configuration
 * functions: implementations decide *how* to ask (readline, a test double, a
 * future richer prompt library), never *what* gets written to
 * `lantern.config.json` — that stays entirely in
 * `state-planning/apply-unresolved-resolution.ts`.
 */
export interface ConfigurePrompter {
  selectAction(component: string, prop: UnresolvedProp): Promise<PromptedAction>;
  promptValues(component: string, prop: UnresolvedProp): Promise<readonly unknown[]>;
  promptFixtureName(component: string, prop: UnresolvedProp): Promise<string>;
  /** `undefined` means reuse an existing fixture as-is, without redefining it. */
  promptFixtureValues(fixtureName: string): Promise<readonly unknown[] | undefined>;
  notify(message: string): void;
}

export interface RunConfigureWorkflowInput {
  readonly configFilePath: string;
  readonly report: LintReport;
  readonly prompter: ConfigurePrompter;
}

export interface RunConfigureWorkflowResult {
  readonly promptedComponents: number;
  readonly resolvedCount: number;
}

/**
 * Guide the user through every unresolved component/prop found in `report`,
 * persisting each choice through RFC-006's reusable configuration workflow —
 * no second configuration writer is introduced.
 */
export async function runConfigureWorkflow(input: RunConfigureWorkflowInput): Promise<RunConfigureWorkflowResult> {
  const { configFilePath, report, prompter } = input;
  const unresolvedComponents = collectUnresolvedComponents(report);

  if (unresolvedComponents.length === 0) {
    prompter.notify("No unresolved components — nothing to configure.");
    return { promptedComponents: 0, resolvedCount: 0 };
  }

  let resolvedCount = 0;

  for (const { component, unresolvedProps } of unresolvedComponents) {
    for (const prop of unresolvedProps) {
      const action = await prompter.selectAction(component, prop);

      if (action === "leave-unresolved") {
        continue;
      }
      if (action === "skip-component") {
        configureSkipComponent(configFilePath, component);
        resolvedCount += 1;
        break;
      }
      if (action === "values") {
        const values = await prompter.promptValues(component, prop);
        configurePropResolution(configFilePath, component, prop.name, { type: "values", values });
        resolvedCount += 1;
        continue;
      }
      if (action === "fixture") {
        const fixture = await prompter.promptFixtureName(component, prop);
        const createWithValues = await prompter.promptFixtureValues(fixture);
        configurePropResolution(configFilePath, component, prop.name, {
          type: "fixture",
          fixture,
          createWithValues,
        });
        resolvedCount += 1;
        continue;
      }
      // "placeholder"
      configurePropResolution(configFilePath, component, prop.name, { type: "placeholder" });
      resolvedCount += 1;
    }
  }

  prompter.notify(
    resolvedCount === 0
      ? "No changes made to lantern.config.json."
      : `Updated ${resolvedCount} prop resolution(s) in lantern.config.json. Run "lantern lint" again to see the effect.`,
  );

  return { promptedComponents: unresolvedComponents.length, resolvedCount };
}
