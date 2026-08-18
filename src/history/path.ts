import { isAbsolute, resolve } from "node:path";
import type { ResolvedConfig } from "../types/config.js";
import type { SurveyHistoryOptions } from "./types.js";

export function resolveSurveyHistoryOptions(config: ResolvedConfig): SurveyHistoryOptions {
  const history = config.survey.history;
  return {
    directory: isAbsolute(history.path) ? history.path : resolve(config.project.root, history.path),
    ...(history.maxRuns === undefined ? {} : { maxRuns: history.maxRuns }),
    ...(history.maxAge === undefined ? {} : { maxAge: history.maxAge }),
  };
}
