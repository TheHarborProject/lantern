import type { SurveyRunV1 } from "../survey/schema/survey-run.js";

export type SurveyHistoryProblemKind = "corrupt" | "unsupported-version" | "conflict";

export interface SurveyHistoryProblem {
  readonly file: string;
  readonly kind: SurveyHistoryProblemKind;
  readonly message: string;
}

export interface SurveyHistoryListing {
  readonly runs: readonly SurveyRunV1[];
  readonly problems: readonly SurveyHistoryProblem[];
}

export interface SurveyHistoryOptions {
  readonly directory: string;
  readonly maxRuns?: number;
  readonly maxAge?: string;
}

export interface RetentionResult {
  readonly deletedIds: readonly string[];
}
