import type { ResolvedConfig } from "../types/config.js";
import type { SurveyRunSink } from "../survey/persistence.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import { resolveSurveyHistoryOptions } from "./path.js";
import { applyRetention } from "./retention.js";
import { deleteSurveyRun, listSurveyRuns, readSurveyRun, saveSurveyRun } from "./repository.js";
import { resolveSurveyRun } from "./catalog.js";
import { serializeSurveyRun } from "./codec.js";
import type { SurveyHistoryListing } from "./types.js";

export function createSurveyHistorySink(config: ResolvedConfig): SurveyRunSink {
  const options = resolveSurveyHistoryOptions(config);
  return {
    save: (run): Promise<void> => {
      saveSurveyRun(options, run);
      applyRetention(options);
      return Promise.resolve();
    },
  };
}

export function listProjectSurveyRuns(config: ResolvedConfig): SurveyHistoryListing { return listSurveyRuns(resolveSurveyHistoryOptions(config)); }
export function resolveProjectSurveyRun(config: ResolvedConfig, selector: string): SurveyRunV1 { return resolveSurveyRun(resolveSurveyHistoryOptions(config), selector); }
export function readProjectSurveyRun(config: ResolvedConfig, id: string): SurveyRunV1 { return readSurveyRun(resolveSurveyHistoryOptions(config), id); }
export function exportSurveyRun(run: SurveyRunV1): string { return serializeSurveyRun(run); }
export function deleteProjectSurveyRun(config: ResolvedConfig, id: string): void { deleteSurveyRun(resolveSurveyHistoryOptions(config), id); }
