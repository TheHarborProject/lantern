import { SurveyHistoryError } from "../errors/survey-history-error.js";
import { parseSurveyRun, type SurveyRunV1 } from "../survey/schema/survey-run.js";

export function serializeSurveyRun(run: SurveyRunV1): string {
  try {
    const validated = parseSurveyRun(run);
    const text = `${JSON.stringify(validated, null, 2)}\n`;
    parseStoredSurveyRun(text);
    return text;
  } catch (cause) {
    if (cause instanceof SurveyHistoryError) throw cause;
    throw new SurveyHistoryError("corrupt", "SurveyRun is not valid canonical JSON-safe data.", { cause });
  }
}

export function parseStoredSurveyRun(text: string): SurveyRunV1 {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new SurveyHistoryError("corrupt", "Stored survey contains invalid JSON.", { cause });
  }
  if (isSurveyEnvelope(value) && value.schema === "lantern-survey-run" && value.version !== 1) {
    throw new SurveyHistoryError("unsupported-version", `Stored survey uses unsupported SurveyRun version ${String(value.version)}.`);
  }
  try {
    return parseSurveyRun(value);
  } catch (cause) {
    throw new SurveyHistoryError("corrupt", "Stored survey does not match the SurveyRunV1 schema.", { cause });
  }
}

function isSurveyEnvelope(value: unknown): value is { readonly schema?: unknown; readonly version?: unknown } {
  return typeof value === "object" && value !== null;
}
