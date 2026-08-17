import { describe, expect, it } from "vitest";
import { configSchema } from "../../schemas/config.js";
import { resolveLanternConfig } from "./resolve-lantern-config.js";

describe("resolveLanternConfig", () => {
  it("falls back to Lantern defaults when nothing is configured", () => {
    const raw = configSchema.parse({ project: {} });

    const resolved = resolveLanternConfig(raw);

    expect(resolved).toEqual({
      standards: ["wcag22-aa"],
      extends: [],
      engines: { static: true, rendered: true, axe: false, lighthouse: false },
      settings: {},
      rules: {},
      components: {},
      overrides: [],
      ignorePatterns: [],
      fixtures: {},
    });
  });

  it("supports multiple simultaneously configured standards as distinct contexts", () => {
    const raw = configSchema.parse({ project: {}, standards: ["wcag22-aa", "rgaa4.1"] });

    expect(resolveLanternConfig(raw).standards).toEqual(["wcag22-aa", "rgaa4.1"]);
  });

  it("applies extends presets before the project configuration", () => {
    const raw = configSchema.parse({ project: {}, extends: ["lantern:recommended"] });

    const resolved = resolveLanternConfig(raw);

    expect(resolved.rules["lantern/color-contrast"]).toBe("error");
    expect(resolved.rules["lantern/focus-visible"]).toBe("warn");
  });

  it("lets the project configuration override a rule enabled by an extended preset", () => {
    const raw = configSchema.parse({
      project: {},
      extends: ["lantern:recommended"],
      rules: { "lantern/color-contrast": "warn" },
    });

    const resolved = resolveLanternConfig(raw);

    expect(resolved.rules["lantern/color-contrast"]).toBe("warn");
    // Other preset rules remain, proving the project layer merges rather than replaces.
    expect(resolved.rules["lantern/focus-visible"]).toBe("warn");
  });

  it("keeps standards and extends distinct concepts", () => {
    const raw = configSchema.parse({
      project: {},
      standards: ["rgaa4.1"],
      extends: ["lantern:recommended"],
    });

    const resolved = resolveLanternConfig(raw);

    expect(resolved.standards).toEqual(["rgaa4.1"]);
    expect(resolved.extends).toEqual(["lantern:recommended"]);
    expect(resolved.rules["lantern/accessible-name"]).toBe("error");
  });

  it("lets project engines override defaults without requiring every engine to be listed", () => {
    const raw = configSchema.parse({ project: {}, engines: { axe: true } });

    expect(resolveLanternConfig(raw).engines).toEqual({ static: true, rendered: true, axe: true, lighthouse: false });
  });

  it("records declared overrides in order for later per-file resolution", () => {
    const raw = configSchema.parse({
      project: {},
      overrides: [
        { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
      ],
    });

    expect(resolveLanternConfig(raw).overrides).toEqual([
      { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
    ]);
  });

  it("resolves component configuration verbatim when no preset declares any", () => {
    const raw = configSchema.parse({
      project: {},
      components: { Avatar: { props: { user: { values: ["guest", "member"] } } } },
    });

    expect(resolveLanternConfig(raw).components).toEqual({
      Avatar: { props: { user: { values: ["guest", "member"] } } },
    });
  });

  it("resolves named fixtures declared at the project level", () => {
    const raw = configSchema.parse({
      project: {},
      fixtures: { users: ["guest", "member"] },
      components: { Avatar: { props: { user: { fixture: "users" } } } },
    });

    const resolved = resolveLanternConfig(raw);

    expect(resolved.fixtures).toEqual({ users: ["guest", "member"] });
    expect(resolved.components["Avatar"]?.props?.["user"]).toEqual({ fixture: "users" });
  });
});
