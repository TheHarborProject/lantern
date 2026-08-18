import { listProjectSurveyRuns } from "../history/service.js";
import type { ResolvedConfig } from "../types/config.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import { buildSelectableComponents } from "./planning.js";
import { resolveInteractiveScan } from "./scan-policy.js";
import { resolveInteractiveDefaults, selectedStateCount, updateSelectedComponents, validateInteractiveSelection } from "./selection.js";
import type { InteractiveSurveyPrompter, InteractiveSurveySelection, ResolvedInteractiveScan } from "./types.js";

export interface PreparedInteractiveSurvey {
  readonly resolvedScan: ResolvedInteractiveScan;
  readonly selection: InteractiveSurveySelection;
}

export async function prepareInteractiveSurvey(input: { readonly config: ResolvedConfig; readonly prompter: InteractiveSurveyPrompter; readonly save: boolean }): Promise<PreparedInteractiveSurvey | null> {
  const resolvedScan = await resolveInteractiveScan(input.config, input.prompter);
  if (resolvedScan === null) return null;
  const components = buildSelectableComponents(resolvedScan.scan.model, input.config);
  const history = input.config.survey.interactive.defaultSelection === "previous" ? safeLatest(input.config) : undefined;
  const defaults = resolveInteractiveDefaults({ strategy: input.config.survey.interactive.defaultSelection, components, delta: resolvedScan.delta, ...(history === undefined ? {} : { previous: history }) });
  const notes = [...resolvedScan.notes, ...defaults.notes];
  let selection = defaults.selection;
  while (true) {
    const componentIds = await input.prompter.chooseComponents(components, selection.componentIds, notes);
    if (componentIds === null) return null;
    selection = updateSelectedComponents(selection, componentIds, components);
    const refined = await input.prompter.refineStates(components, selection);
    if (refined === null) return null;
    selection = refined;
    if (!input.config.survey.interactive.confirm) return { resolvedScan, selection: validateInteractiveSelection(selection, components) };
    const choice = await input.prompter.confirmPlan({
      selectedComponents: selection.componentIds.length,
      totalComponents: components.length,
      selectedStates: selectedStateCount(selection, components),
      standards: input.config.standards,
      save: input.save,
    });
    if (choice === "cancel") return null;
    if (choice === "back") continue;
    return { resolvedScan, selection: validateInteractiveSelection(selection, components) };
  }
}

function safeLatest(config: ResolvedConfig): SurveyRunV1 | undefined {
  try { return listProjectSurveyRuns(config).runs[0]; }
  catch { return undefined; }
}
