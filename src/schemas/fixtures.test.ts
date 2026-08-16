import { describe, expect, it } from "vitest";
import { fixturesSchema } from "./fixtures.js";

describe("fixturesSchema", () => {
  it("accepts named reusable value lists", () => {
    expect(fixturesSchema.parse({ users: ["guest", "member", "admin"] })).toEqual({
      users: ["guest", "member", "admin"],
    });
  });

  it("accepts an empty fixtures map", () => {
    expect(fixturesSchema.parse({})).toEqual({});
  });

  it("rejects a non-array fixture value", () => {
    const result = fixturesSchema.safeParse({ users: "guest" });

    expect(result.success).toBe(false);
  });
});
