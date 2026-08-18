import { InteractiveSurveyError } from "../errors/interactive-survey-error.js";
import type { InteractiveDefaultSelection } from "../schemas/survey.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import type { ScanDelta } from "../scan/types.js";
import type { InteractiveDefaults, InteractiveSurveySelection, SelectableComponent } from "./types.js";

export function resolveInteractiveDefaults(input: { readonly strategy: InteractiveDefaultSelection; readonly components: readonly SelectableComponent[]; readonly delta: ScanDelta; readonly previous?: SurveyRunV1 }): InteractiveDefaults {
  const available = new Set(input.components.map(({ id }) => id));
  if (input.strategy === "all") return { selection: allSelection(input.components), notes: [] };
  if (input.strategy === "changed") {
    const ids = [...new Set([...input.delta.new, ...input.delta.changed])].filter((id) => available.has(id)).sort();
    return { selection: { componentIds: ids, states: { kind: "all" } }, notes: ids.length === 0 ? ["No new or changed components are present in the resolved scan delta."] : [] };
  }
  if (input.previous === undefined) return { selection: allSelection(input.components), notes: ["No previous saved survey exists; selected all components instead."] };
  const removedComponents = input.previous.targeting.componentIds.filter((id) => !available.has(id));
  const componentIds = input.previous.targeting.componentIds.filter((id) => available.has(id)).sort();
  const validStates = new Set(input.components.filter(({ id }) => componentIds.includes(id)).flatMap(({ states }) => states.map(({ id }) => id)));
  const previousStates = input.previous.targeting.stateIds;
  const stateIds = previousStates?.filter((id) => validStates.has(id)).sort();
  const removedStates = previousStates?.filter((id) => !validStates.has(id)) ?? [];
  const notes = [
    ...(removedComponents.length === 0 ? [] : [`Ignored ${removedComponents.length} previous component selection(s) that no longer exist.`]),
    ...(removedStates.length === 0 ? [] : [`Ignored ${removedStates.length} previous state selection(s) that no longer exist.`]),
  ];
  return { selection: { componentIds, states: stateIds === undefined ? { kind: "all" } : { kind: "restricted", ids: stateIds } }, notes };
}

export function allSelection(components: readonly SelectableComponent[]): InteractiveSurveySelection {
  return { componentIds: components.map(({ id }) => id).sort(), states: { kind: "all" } };
}

export function toggleAllComponents(components: readonly SelectableComponent[], selectedIds: readonly string[]): readonly string[] {
  return selectedIds.length === components.length ? [] : components.map(({ id }) => id).sort();
}

export function updateSelectedComponents(selection: InteractiveSurveySelection, componentIds: readonly string[], components: readonly SelectableComponent[]): InteractiveSurveySelection {
  const ids = [...new Set(componentIds)].sort();
  if (selection.states.kind === "all") return { componentIds: ids, states: selection.states };
  const previouslySelected = new Set(selection.componentIds);
  const previousStates = new Set(selection.states.ids);
  const stateIds = components.filter(({ id }) => ids.includes(id)).flatMap((component) =>
    previouslySelected.has(component.id) ? component.states.filter(({ id }) => previousStates.has(id)).map(({ id }) => id) : component.states.map(({ id }) => id),
  );
  return { componentIds: ids, states: { kind: "restricted", ids: [...new Set(stateIds)].sort() } };
}

export function validateInteractiveSelection(selection: InteractiveSurveySelection, components: readonly SelectableComponent[]): InteractiveSurveySelection {
  const componentIds = [...new Set(selection.componentIds)].sort();
  if (componentIds.length === 0) throw new InteractiveSurveyError("Select at least one component before starting the survey.");
  const availableComponents = new Set(components.map(({ id }) => id));
  const unknownComponents = componentIds.filter((id) => !availableComponents.has(id));
  if (unknownComponents.length > 0) throw new InteractiveSurveyError(`Unknown interactive component selection: ${unknownComponents.join(", ")}`);
  if (selection.states.kind === "all") return { componentIds, states: selection.states };
  const availableStates = new Set(components.filter(({ id }) => componentIds.includes(id)).flatMap(({ states }) => states.map(({ id }) => id)));
  const ids = [...new Set(selection.states.ids)].sort();
  const unknownStates = ids.filter((id) => !availableStates.has(id));
  if (unknownStates.length > 0) throw new InteractiveSurveyError(`Unknown interactive state selection: ${unknownStates.join(", ")}`);
  return { componentIds, states: { kind: "restricted", ids } };
}

export function selectedStateCount(selection: InteractiveSurveySelection, components: readonly SelectableComponent[]): number {
  if (selection.states.kind === "restricted") return selection.states.ids.length;
  return components.filter(({ id }) => selection.componentIds.includes(id)).reduce((total, component) => total + component.states.length, 0);
}
