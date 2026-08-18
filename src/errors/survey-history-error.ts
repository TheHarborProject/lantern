import { LanternError } from "./lantern-error.js";

export type SurveyHistoryErrorKind =
  | "ambiguous-id"
  | "conflict"
  | "corrupt"
  | "empty"
  | "io"
  | "unknown-id"
  | "unsupported-version";

export class SurveyHistoryError extends LanternError {
  readonly code = "SURVEY_HISTORY_ERROR";
  constructor(readonly kind: SurveyHistoryErrorKind, message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
  }
}
