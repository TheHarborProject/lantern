import { describe, expect, it } from "vitest";
import type { ResolvedLanternConfig } from "../../types/config.js";
import { LANTERN_DEFAULTS } from "./lantern-defaults.js";
import { mergeFragment } from "./merge-fragments.js";

function base(overrides: Partial<ResolvedLanternConfig> = {}): ResolvedLanternConfig {
  return { ...LANTERN_DEFAULTS, ...overrides };
}

describe("mergeFragment", () => {
  it("replaces standards (array) instead of concatenating", () => {
    const merged = mergeFragment(base({ standards: ["wcag22-aa"] }), { standards: ["rgaa4.1"] });

    expect(merged.standards).toEqual(["rgaa4.1"]);
  });

  it("keeps the base standards when the next layer does not declare any", () => {
    const merged = mergeFragment(base({ standards: ["wcag22-aa"] }), {});

    expect(merged.standards).toEqual(["wcag22-aa"]);
  });

  it("merges engines by key, later layer wins per engine", () => {
    const merged = mergeFragment(base({ engines: { static: true, axe: false, lighthouse: false } }), {
      engines: { axe: true },
    });

    expect(merged.engines).toEqual({ static: true, axe: true, lighthouse: false });
  });

  it("merges rules by key, later layer wins per rule id", () => {
    const merged = mergeFragment(base({ rules: { "lantern/focus-visible": "warn" } }), {
      rules: { "lantern/focus-visible": "off", "lantern/color-contrast": "error" },
    });

    expect(merged.rules).toEqual({
      "lantern/focus-visible": "off",
      "lantern/color-contrast": "error",
    });
  });

  it("shallow merges settings by key", () => {
    const merged = mergeFragment(base({ settings: { a: 1 } }), { settings: { b: 2 } });

    expect(merged.settings).toEqual({ a: 1, b: 2 });
  });

  it("merges components by name and then by prop name", () => {
    const merged = mergeFragment(
      base({ components: { Avatar: { props: { user: { values: ["guest"] } } } } }),
      { components: { Avatar: { props: { size: { values: ["sm"] } } } } },
    );

    expect(merged.components).toEqual({
      Avatar: { props: { user: { values: ["guest"] }, size: { values: ["sm"] } } },
    });
  });

  it("replaces a prop's values outright when redeclared by a later layer", () => {
    const merged = mergeFragment(base({ components: { Avatar: { props: { user: { values: ["guest"] } } } } }), {
      components: { Avatar: { props: { user: { values: ["admin"] } } } },
    });

    expect(merged.components).toEqual({ Avatar: { props: { user: { values: ["admin"] } } } });
  });

  it("concatenates overrides, preserving declared order", () => {
    const merged = mergeFragment(base({ overrides: [{ files: ["a/**"] }] }), {
      overrides: [{ files: ["b/**"] }],
    });

    expect(merged.overrides.map((override) => override.files[0])).toEqual(["a/**", "b/**"]);
  });

  it("replaces ignorePatterns instead of concatenating", () => {
    const merged = mergeFragment(base({ ignorePatterns: ["dist/"] }), {
      ignorePatterns: ["coverage/"],
    });

    expect(merged.ignorePatterns).toEqual(["coverage/"]);
  });

  it("carries the base extends list through unchanged", () => {
    const merged = mergeFragment(base({ extends: ["lantern:recommended"] }), {
      rules: { "lantern/focus-visible": "off" },
    });

    expect(merged.extends).toEqual(["lantern:recommended"]);
  });
});
