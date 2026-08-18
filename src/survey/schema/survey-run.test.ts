import { describe, expect, it } from "vitest";
import { parseSurveyRun } from "./survey-run.js";

const valid = {
  schema: "lantern-survey-run", version: 1, id: "00000000-0000-4000-8000-000000000001",
  startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:00:00.001Z", status: "completed",
  project: { fingerprint: "a".repeat(64) },
  targeting: { source: "all", componentIds: [], scan: { fingerprint: "b".repeat(64), wasStale: false, refreshed: false } },
  config: { schemaVersion: 1, fingerprint: "c".repeat(64), standards: [], rules: {}, engines: {}, execution: { maxStates: 50 }, scanPolicy: "refresh" },
  engines: [], diagnostics: [], standards: [],
  summary: { componentsPass: 0, componentsFail: 0, componentsReview: 0, componentsSkipped: 0, checksPass: 0, checksFail: 0, checksReview: 0, durationMs: 1 },
} as const;

describe("SurveyRunV1", () => {
  it("round-trips as the canonical strict JSON-safe representation", () => {
    const run = parseSurveyRun(valid);
    expect(parseSurveyRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
  });
  it("rejects corrupt, future, non-finite, and runtime-only values", () => {
    expect(() => parseSurveyRun({ ...valid, version: 2 })).toThrow();
    expect(() => parseSurveyRun({ ...valid, summary: { ...valid.summary, durationMs: Number.NaN } })).toThrow();
    expect(() => parseSurveyRun({ ...valid, runtime: () => undefined })).toThrow();
  });
});
