import { LanternError } from "./lantern-error.js";

export class SurveyScanError extends LanternError {
  readonly code = "SURVEY_SCAN_INVALID";
}
