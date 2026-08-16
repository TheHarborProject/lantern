import { describe, expect, it } from "vitest";
import { resolveRulesForFile } from "./resolve-rules-for-file.js";

describe("resolveRulesForFile", () => {
  const rules = { "lantern/focus-visible": "warn" as const, "lantern/color-contrast": "error" as const };

  it("returns the top-level rules when no override matches", () => {
    const resolved = resolveRulesForFile({ rules, overrides: [{ files: ["src/other/**"] }] }, "src/Button.tsx");

    expect(resolved).toEqual(rules);
  });

  it("applies a matching override on top of the top-level rules", () => {
    const resolved = resolveRulesForFile(
      {
        rules,
        overrides: [
          { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
        ],
      },
      "src/components/internal/Debug.tsx",
    );

    expect(resolved).toEqual({ "lantern/focus-visible": "off", "lantern/color-contrast": "error" });
  });

  it("applies later matching overrides after earlier ones, in declared order", () => {
    const resolved = resolveRulesForFile(
      {
        rules,
        overrides: [
          { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
          { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "warn" } },
        ],
      },
      "src/components/internal/Debug.tsx",
    );

    expect(resolved["lantern/focus-visible"]).toBe("warn");
  });

  it("ignores overrides whose files do not match", () => {
    const resolved = resolveRulesForFile(
      { rules, overrides: [{ files: ["src/other/**"], rules: { "lantern/focus-visible": "off" } }] },
      "src/components/internal/Debug.tsx",
    );

    expect(resolved).toEqual(rules);
  });
});
