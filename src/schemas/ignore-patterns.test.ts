import { describe, expect, it } from "vitest";
import { ignorePatternsSchema } from "./ignore-patterns.js";

describe("ignorePatternsSchema", () => {
  it("accepts a list of glob patterns", () => {
    expect(ignorePatternsSchema.parse(["node_modules/", "dist/", "**/*.stories.tsx"])).toEqual([
      "node_modules/",
      "dist/",
      "**/*.stories.tsx",
    ]);
  });

  it("accepts an empty list", () => {
    expect(ignorePatternsSchema.parse([])).toEqual([]);
  });

  it("rejects a non-string pattern", () => {
    const result = ignorePatternsSchema.safeParse(["dist/", 42]);

    expect(result.success).toBe(false);
  });
});
