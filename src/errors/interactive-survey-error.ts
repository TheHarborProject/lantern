import { LanternError } from "./lantern-error.js";

export class InteractiveSurveyError extends LanternError {
  readonly code = "INTERACTIVE_SURVEY_INVALID";
}
