import { describe, expect, it } from "vitest";
import { standardsSchema } from "./standards.js";

describe("standardsSchema", () => {
  it("accepts a single known standard", () => {
    expect(standardsSchema.parse(["wcag22-aa"])).toEqual(["wcag22-aa"]);
  });

  it("accepts multiple distinct standards evaluated as separate contexts", () => {
    expect(standardsSchema.parse(["wcag22-aa", "rgaa4.1"])).toEqual(["wcag22-aa", "rgaa4.1"]);
  });

  it("accepts an empty list", () => {
    expect(standardsSchema.parse([])).toEqual([]);
  });

  it("rejects an unknown standard with an actionable message", () => {
    const result = standardsSchema.safeParse(["wcag99-aa"]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([0]);
    }
  });

  it("rejects duplicate standards", () => {
    const result = standardsSchema.safeParse(["wcag22-aa", "wcag22-aa"]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Duplicate standard");
    }
  });
});
