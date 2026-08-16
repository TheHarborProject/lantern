import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settings.js";

describe("settingsSchema", () => {
  it("accepts an empty settings object", () => {
    expect(settingsSchema.parse({})).toEqual({});
  });

  it("accepts arbitrary shared settings without a predefined catalog", () => {
    expect(settingsSchema.parse({ locale: "fr-FR", strictColorContrast: true })).toEqual({
      locale: "fr-FR",
      strictColorContrast: true,
    });
  });

  it("rejects a non-object value", () => {
    const result = settingsSchema.safeParse("not-an-object");

    expect(result.success).toBe(false);
  });
});
