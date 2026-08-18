import { checkbox, select } from "@inquirer/prompts";
import type { InteractiveSurveyPrompter, InteractiveSurveySelection, SelectableComponent } from "./types.js";

export function createTerminalSurveyPrompter(): InteractiveSurveyPrompter {
  return {
    chooseStaleScan: async (reason) => prompt(() => select({ message: `Scan is outdated (${reason})`, choices: [
      { name: "Refresh scan", value: "refresh" as const },
      { name: "Use previous scan", value: "current" as const },
      { name: "Cancel", value: "cancel" as const },
    ] }), "cancel"),
    chooseComponents: async (components, selectedIds, notes) => prompt(() => checkbox({
      message: ["Select components to survey", ...notes].join(" — "),
      choices: components.map((component) => ({ name: `${component.name}  ${component.source}`, value: component.id, checked: selectedIds.includes(component.id) })),
      instructions: "↑↓ navigate, space toggle, a toggle all, enter continue",
      pageSize: 15,
    }), null),
    refineStates: async (components, selection) => refineStates(components, selection),
    confirmPlan: async (plan) => prompt(() => select({
      message: `Survey plan — ${plan.selectedComponents}/${plan.totalComponents} components, ${plan.selectedStates} states, ${plan.standards.join(", ")}, save ${plan.save ? "yes" : "no"}`,
      choices: [
        { name: "Start survey", value: "start" as const },
        { name: "Back to selection", value: "back" as const },
        { name: "Cancel", value: "cancel" as const },
      ],
    }), "cancel"),
  };
}

async function refineStates(components: readonly SelectableComponent[], selection: InteractiveSurveySelection): Promise<InteractiveSurveySelection | null> {
  const candidates = components.filter(({ id, states }) => selection.componentIds.includes(id) && states.length > 1);
  if (candidates.length === 0) return selection;
  const refineIds = await prompt(() => checkbox({
    message: "Optionally choose components whose states you want to refine",
    choices: candidates.map((component) => ({ name: `${component.name} (${component.states.length} states)`, value: component.id })),
    instructions: "Leave empty to keep all planned states",
    pageSize: 15,
  }), null);
  if (refineIds === null || refineIds.length === 0) return refineIds === null ? null : selection;
  const selected = new Set<string>();
  for (const component of components.filter(({ id }) => selection.componentIds.includes(id))) {
    if (!refineIds.includes(component.id)) { component.states.forEach(({ id }) => selected.add(id)); continue; }
    const restrictedIds = selection.states.kind === "restricted" ? selection.states.ids : undefined;
    const existing = restrictedIds === undefined ? component.states.map(({ id }) => id) : component.states.filter(({ id }) => restrictedIds.includes(id)).map(({ id }) => id);
    const stateIds = await prompt(() => checkbox({
      message: `${component.name} states`,
      choices: component.states.map((state) => ({ name: state.label, value: state.id, checked: existing.includes(state.id) })),
      instructions: "↑↓ navigate, space toggle, a toggle all, enter continue",
      pageSize: 15,
    }), null);
    if (stateIds === null) return null;
    stateIds.forEach((id) => selected.add(id));
  }
  return { componentIds: selection.componentIds, states: { kind: "restricted", ids: [...selected].sort() } };
}

async function prompt<T>(operation: () => Promise<T>, cancelled: T): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof Error && (error.name === "ExitPromptError" || error.message.includes("force closed"))) return cancelled;
    throw error;
  }
}
