import { describe, expect, it } from "vitest";
import { resolveActiveRules } from "./resolve-active-rules.js";

describe("resolveActiveRules", () => {
  it("resolves a bare severity", () => {
    const active = resolveActiveRules({ "lantern/accessible-name": "error" });

    expect(active.get("lantern/accessible-name")).toBe("error");
  });

  it("resolves the severity out of a [severity, options] tuple", () => {
    const active = resolveActiveRules({ "lantern/color-contrast": ["warn", { minimumRatio: 4.5 }] });

    expect(active.get("lantern/color-contrast")).toBe("warn");
  });

  it("drops rules configured off", () => {
    const active = resolveActiveRules({ "lantern/focus-visible": "off" });

    expect(active.has("lantern/focus-visible")).toBe(false);
  });

  it("returns an empty map for an empty rules config", () => {
    expect(resolveActiveRules({}).size).toBe(0);
  });
});
