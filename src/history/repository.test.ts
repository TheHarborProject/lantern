import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSurveyRun } from "./catalog.js";
import { serializeSurveyRun } from "./codec.js";
import { deleteSurveyRun, listSurveyRuns, readSurveyRun, saveSurveyRun } from "./repository.js";
import { historyTestRun } from "../testing/history-test-run.js";
import type { SurveyHistoryOptions } from "./types.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "11111111-1111-4111-8111-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";

describe("SurveyRun repository and catalog", () => {
  let root: string;
  let options: SurveyHistoryOptions;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lantern-history-")); options = { directory: join(root, "custom-history") }; });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("atomically writes, validates, and round-trips the exact export representation", () => {
    const run = historyTestRun(ID_A, "2026-01-01T00:00:00.000Z", { name: "baseline" });
    saveSurveyRun(options, run);
    expect(readSurveyRun(options, ID_A)).toEqual(run);
    expect(readdirSync(options.directory)).toEqual([`${ID_A}.json`]);
    expect(serializeSurveyRun(readSurveyRun(options, ID_A))).toBe(serializeSurveyRun(run));
    saveSurveyRun(options, run);
    expect(readdirSync(options.directory)).toEqual([`${ID_A}.json`]);
  });

  it("rejects a conflicting duplicate ID without overwriting", () => {
    saveSurveyRun(options, historyTestRun(ID_A, "2026-01-01T00:00:00.000Z"));
    expect(() => saveSurveyRun(options, historyTestRun(ID_A, "2026-01-01T00:00:00.000Z", { name: "different" }))).toThrow(/different content/);
    expect(readSurveyRun(options, ID_A).name).toBeUndefined();
  });

  it("isolates invalid JSON, invalid schema, future versions, and filename conflicts", () => {
    saveSurveyRun(options, historyTestRun(ID_C, "2026-01-03T00:00:00.000Z"));
    writeFileSync(join(options.directory, `${ID_A}.json`), "{");
    writeFileSync(join(options.directory, `${ID_B}.json`), JSON.stringify({ schema: "lantern-survey-run", version: 2 }));
    writeFileSync(join(options.directory, "44444444-4444-4444-8444-444444444444.json"), serializeSurveyRun(historyTestRun(ID_A, "2026-01-01T00:00:00.000Z")));
    writeFileSync(join(options.directory, "not-an-id.json"), "{}");
    const listing = listSurveyRuns(options);
    expect(listing.runs.map(({ id }) => id)).toEqual([ID_C]);
    expect(listing.problems.map(({ kind }) => kind).sort()).toEqual(["conflict", "corrupt", "corrupt", "unsupported-version"]);
  });

  it("handles an absent/empty store and deletes exactly one run", () => {
    expect(listSurveyRuns(options)).toEqual({ runs: [], problems: [] });
    expect(() => resolveSurveyRun(options, "last")).toThrow(/No saved surveys/);
    saveSurveyRun(options, historyTestRun(ID_A, "2026-01-01T00:00:00.000Z"));
    saveSurveyRun(options, historyTestRun(ID_C, "2026-01-02T00:00:00.000Z"));
    deleteSurveyRun(options, ID_A);
    expect(existsSync(join(options.directory, `${ID_A}.json`))).toBe(false);
    expect(readSurveyRun(options, ID_C).id).toBe(ID_C);
  });

  it("resolves full IDs, any unique prefix, ambiguity, unknown IDs, and deterministic last", () => {
    saveSurveyRun(options, historyTestRun(ID_A, "2026-01-01T00:00:00.000Z"));
    saveSurveyRun(options, historyTestRun(ID_B, "2026-01-02T00:00:00.000Z"));
    saveSurveyRun(options, historyTestRun(ID_C, "2026-01-02T00:00:00.000Z"));
    expect(resolveSurveyRun(options, ID_A).id).toBe(ID_A);
    expect(resolveSurveyRun(options, "333").id).toBe(ID_C);
    expect(() => resolveSurveyRun(options, "111")).toThrow(/ambiguous/);
    expect(() => resolveSurveyRun(options, "previous")).toThrow(/No saved survey/);
    expect(resolveSurveyRun(options, "last").id).toBe(ID_B);
  });
});
