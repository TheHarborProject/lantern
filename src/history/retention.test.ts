import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyRetention } from "./retention.js";
import { listSurveyRuns, saveSurveyRun } from "./repository.js";
import { historyTestRun } from "../testing/history-test-run.js";
import type { SurveyHistoryOptions } from "./types.js";

const IDS = ["10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "30000000-0000-4000-8000-000000000003"];

describe("survey retention", () => {
  let root: string;
  let base: SurveyHistoryOptions;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-retention-")); base = { directory: join(root, "surveys") };
    saveSurveyRun(base, historyTestRun(IDS[0] as string, "2026-01-01T00:00:00.000Z"));
    saveSurveyRun(base, historyTestRun(IDS[1] as string, "2026-01-10T00:00:00.000Z"));
    saveSurveyRun(base, historyTestRun(IDS[2] as string, "2026-01-20T00:00:00.000Z"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("keeps unlimited history by default and enforces maxRuns", () => {
    expect(applyRetention(base).deletedIds).toEqual([]);
    expect(applyRetention({ ...base, maxRuns: 2 }).deletedIds).toEqual([IDS[0]]);
  });
  it("enforces maxAge before maxRuns with deterministic combined semantics", () => {
    const now = Date.parse("2026-01-21T00:00:00.000Z");
    expect(applyRetention({ ...base, maxAge: "15d", maxRuns: 1 }, now).deletedIds).toEqual([IDS[0], IDS[1]]);
    expect(listSurveyRuns(base).runs.map(({ id }) => id)).toEqual([IDS[2]]);
  });
  it("enforces maxAge independently", () => {
    const now = Date.parse("2026-01-21T00:00:00.000Z");
    expect(applyRetention({ ...base, maxAge: "15d" }, now).deletedIds).toEqual([IDS[0]]);
  });
  it("never silently prunes corrupt or unsupported files", () => {
    writeFileSync(join(base.directory, "40000000-0000-4000-8000-000000000004.json"), "{");
    expect(() => applyRetention({ ...base, maxRuns: 1 })).toThrow(/Retention stopped/);
    expect(listSurveyRuns(base).runs).toHaveLength(3);
  });
});
