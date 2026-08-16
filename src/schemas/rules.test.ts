import { describe, expect, it } from "vitest";
import { rulesSchema } from "./rules.js";

describe("rulesSchema", () => {
  it("accepts a bare severity", () => {
    expect(rulesSchema.parse({ "lantern/accessible-name": "error" })).toEqual({
      "lantern/accessible-name": "error",
    });
  });

  it("accepts every required severity", () => {
    const parsed = rulesSchema.parse({
      "lantern/accessible-name": "off",
      "lantern/focus-visible": "warn",
      "lantern/color-contrast": "error",
    });

    expect(parsed).toEqual({
      "lantern/accessible-name": "off",
      "lantern/focus-visible": "warn",
      "lantern/color-contrast": "error",
    });
  });

  it("accepts a [severity, options] tuple", () => {
    const parsed = rulesSchema.parse({
      "lantern/keyboard-access": ["error", { requireNativeSemantics: true }],
    });

    expect(parsed).toEqual({
      "lantern/keyboard-access": ["error", { requireNativeSemantics: true }],
    });
  });

  it("rejects an invalid severity", () => {
    const result = rulesSchema.safeParse({ "lantern/accessible-name": "critical" });

    expect(result.success).toBe(false);
  });

  it("rejects a tuple missing options", () => {
    const result = rulesSchema.safeParse({ "lantern/keyboard-access": ["error"] });

    expect(result.success).toBe(false);
  });

  it("rejects a tuple with a non-object options value", () => {
    const result = rulesSchema.safeParse({ "lantern/keyboard-access": ["error", "strict"] });

    expect(result.success).toBe(false);
  });

  it("rejects a tuple with extra entries", () => {
    const result = rulesSchema.safeParse({
      "lantern/keyboard-access": ["error", {}, "extra"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a rule id that is not namespaced", () => {
    const result = rulesSchema.safeParse({ "accessible-name": "error" });

    expect(result.success).toBe(false);
  });
});
