import type { CheckResult, ComponentReport, StateReport } from "../lint/types.js";
import type { SurveyDiagnosticV1, SurveyRunV1 } from "./schema/survey-run.js";

type RunRef = { readonly runId: string; readonly timestamp: string };
export type SurveyEvent =
  | (RunRef & { readonly type: "survey-started" })
  | (RunRef & { readonly type: "survey-planned"; readonly totalComponents: number })
  | (RunRef & { readonly type: "component-started"; readonly componentId: string; readonly source: string; readonly component: string })
  | (RunRef & { readonly type: "state-started"; readonly componentId: string; readonly stateId: string })
  | (RunRef & { readonly type: "check-started"; readonly componentId: string; readonly stateId: string; readonly checkId: string; readonly ruleId: string })
  | (RunRef & { readonly type: "check-completed"; readonly result: CheckResult })
  | (RunRef & { readonly type: "state-completed"; readonly state: StateReport })
  | (RunRef & { readonly type: "component-completed"; readonly component: ComponentReport })
  | (RunRef & { readonly type: "diagnostic"; readonly diagnostic: SurveyDiagnosticV1 })
  | (RunRef & { readonly type: "survey-completed" | "survey-failed" | "survey-cancelled"; readonly run: SurveyRunV1 });

export type SurveyEventSink = (event: SurveyEvent) => void | Promise<void>;

export class SurveyCancelledError extends Error {
  constructor() { super("Survey cancelled."); this.name = "SurveyCancelledError"; }
}
