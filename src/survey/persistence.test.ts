import { describe, expect, it, vi } from "vitest";
import { deliverSurveyRun, shouldPersistSurveyRun } from "./persistence.js";
import type { SurveyRunV1 } from "./schema/survey-run.js";

describe("survey persistence decision boundary", () => {
  it("defaults local on and CI off, with --no-save taking precedence", () => {
    expect(shouldPersistSurveyRun({})).toBe(true);
    expect(shouldPersistSurveyRun({ ci: true })).toBe(false);
    expect(shouldPersistSurveyRun({ ci: true, ciEnabled: true })).toBe(true);
    expect(shouldPersistSurveyRun({ noSave: true, localEnabled: true })).toBe(false);
  });
  it("delivers a finalized run without changing it", async () => {
    const run = Object.freeze({ id: "run" }) as unknown as SurveyRunV1;
    const save = vi.fn(() => Promise.resolve());
    await deliverSurveyRun(run, { save }, true);
    expect(save).toHaveBeenCalledWith(run);
  });
});
