import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../config/load-config.js";
import { createSurveyHistorySink, listProjectSurveyRuns } from "./service.js";
import { historyTestRun } from "../testing/history-test-run.js";

describe("project survey history sink", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

  it("uses the configured project-relative path and saves every finalized lifecycle", async () => {
    const root = mkdtempSync(join(tmpdir(), "lantern-history-sink-")); roots.push(root);
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {}, survey: { history: { path: "artifacts/runs", listMax: 5 } } }));
    const config = loadConfig({ cwd: root });
    const sink = createSurveyHistorySink(config);
    const statuses = ["completed", "failed", "cancelled"] as const;
    for (const [index, status] of statuses.entries()) {
      await sink.save(historyTestRun(`${index + 1}0000000-0000-4000-8000-00000000000${index + 1}`, `2026-01-0${index + 1}T00:00:00.000Z`, { status }));
    }
    expect(readdirSync(join(root, "artifacts", "runs"))).toHaveLength(3);
    expect(listProjectSurveyRuns(config).runs.map(({ status }) => status)).toEqual(["cancelled", "failed", "completed"]);
  });
});
