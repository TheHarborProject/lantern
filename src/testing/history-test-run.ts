import { parseSurveyRun, type SurveyRunV1 } from "../survey/schema/survey-run.js";

export function historyTestRun(id: string, startedAt: string, overrides: Partial<SurveyRunV1> = {}): SurveyRunV1 {
  return parseSurveyRun({
    schema: "lantern-survey-run", version: 1, id, startedAt, finishedAt: startedAt, status: "completed",
    project: { fingerprint: "a".repeat(64) },
    targeting: { source: "all", componentIds: [], scan: { fingerprint: "b".repeat(64), wasStale: false, refreshed: false } },
    config: { schemaVersion: 1, fingerprint: "c".repeat(64), standards: ["wcag22-aa"], rules: {}, engines: {}, execution: { maxStates: 50 }, scanPolicy: "refresh" },
    engines: [], diagnostics: [], standards: [{ standard: "wcag22-aa", components: [] }],
    summary: { componentsPass: 0, componentsFail: 0, componentsReview: 0, componentsSkipped: 0, checksPass: 0, checksFail: 0, checksReview: 0, durationMs: 0 },
    ...overrides,
  });
}
