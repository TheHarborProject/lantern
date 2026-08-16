import { describe, expect, it } from "vitest";
import { extendsSchema } from "./extends.js";

describe("extendsSchema", () => {
  it("accepts a known preset", () => {
    expect(extendsSchema.parse(["lantern:recommended"])).toEqual(["lantern:recommended"]);
  });

  it("accepts an empty list", () => {
    expect(extendsSchema.parse([])).toEqual([]);
  });

  it("rejects an unknown preset id", () => {
    const result = extendsSchema.safeParse(["lantern:does-not-exist"]);

    expect(result.success).toBe(false);
  });

  it("preserves declared order for deterministic resolution", () => {
    expect(extendsSchema.parse(["lantern:recommended", "lantern:recommended"])).toEqual([
      "lantern:recommended",
      "lantern:recommended",
    ]);
  });
});
