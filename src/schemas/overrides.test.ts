import { describe, expect, it } from "vitest";
import { overridesSchema } from "./overrides.js";

describe("overridesSchema", () => {
  it("accepts a matching override with rules", () => {
    const parsed = overridesSchema.parse([
      { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
    ]);

    expect(parsed).toEqual([
      { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
    ]);
  });

  it("accepts an override without rules", () => {
    expect(overridesSchema.parse([{ files: ["src/**"] }])).toEqual([{ files: ["src/**"] }]);
  });

  it("preserves declared order for deterministic application", () => {
    const parsed = overridesSchema.parse([{ files: ["a/**"] }, { files: ["b/**"] }]);

    expect(parsed.map((override) => override.files[0])).toEqual(["a/**", "b/**"]);
  });

  it("rejects an override with no file patterns", () => {
    const result = overridesSchema.safeParse([{ files: [] }]);

    expect(result.success).toBe(false);
  });

  it("rejects an override missing files", () => {
    const result = overridesSchema.safeParse([{ rules: { "lantern/focus-visible": "off" } }]);

    expect(result.success).toBe(false);
  });

  it("rejects an unknown key on an override", () => {
    const result = overridesSchema.safeParse([{ files: ["src/**"], scope: "internal" }]);

    expect(result.success).toBe(false);
  });

  it("rejects malformed rules inside an override", () => {
    const result = overridesSchema.safeParse([
      { files: ["src/**"], rules: { "lantern/focus-visible": "critical" } },
    ]);

    expect(result.success).toBe(false);
  });
});
