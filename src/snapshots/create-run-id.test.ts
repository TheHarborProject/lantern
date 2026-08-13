import { describe, expect, it } from "vitest";
import { createRunId } from "./create-run-id.js";

describe("createRunId", () => {
  it("formats the launch timestamp as YYYY-MM-DD_HHmm", () => {
    expect(createRunId(new Date(2026, 7, 6, 18, 56, 0))).toBe("2026-08-06_1856");
  });
});
