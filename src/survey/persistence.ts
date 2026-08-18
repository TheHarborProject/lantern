import type { SurveyRunV1 } from "./schema/survey-run.js";

export interface SurveyRunSink {
  save(run: SurveyRunV1): Promise<void>;
}

export interface PersistenceDecisionOptions {
  readonly noSave?: boolean;
  readonly ci?: boolean;
  readonly localEnabled?: boolean;
  readonly ciEnabled?: boolean;
}

export function shouldPersistSurveyRun(options: PersistenceDecisionOptions): boolean {
  if (options.noSave === true) return false;
  return options.ci === true ? (options.ciEnabled ?? false) : (options.localEnabled ?? true);
}

export async function deliverSurveyRun(run: SurveyRunV1, sink: SurveyRunSink | undefined, enabled: boolean): Promise<void> {
  if (enabled && sink !== undefined) await sink.save(run);
}
