import { describe, expect, it } from "vitest";
import { configSchema } from "../schemas/config.js";
import type { RawConfig } from "../types/config.js";
import { applyPropResolution, applySkipComponent } from "./apply-unresolved-resolution.js";

function baseConfig(overrides: Record<string, unknown> = {}): RawConfig {
  return configSchema.parse({ project: {}, ...overrides });
}

describe("applyPropResolution", () => {
  it("writes explicit values for an unresolved prop", () => {
    const updated = applyPropResolution(baseConfig(), "Avatar", "user", {
      type: "values",
      values: ["guest", "admin"],
    });

    expect(updated.components).toEqual({ Avatar: { props: { user: { values: ["guest", "admin"] } } } });
    // Still a valid RawConfig.
    expect(() => configSchema.parse(updated)).not.toThrow();
  });

  it("writes a fixture reference without creating the fixture when none is given", () => {
    const updated = applyPropResolution(baseConfig(), "Avatar", "user", {
      type: "fixture",
      fixture: "users",
    });

    expect(updated.components).toEqual({ Avatar: { props: { user: { fixture: "users" } } } });
    expect(updated.fixtures).toBeUndefined();
  });

  it("writes a fixture reference and creates the fixture when values are given", () => {
    const updated = applyPropResolution(baseConfig(), "Avatar", "user", {
      type: "fixture",
      fixture: "users",
      createWithValues: ["guest", "admin"],
    });

    expect(updated.components).toEqual({ Avatar: { props: { user: { fixture: "users" } } } });
    expect(updated.fixtures).toEqual({ users: ["guest", "admin"] });
  });

  it("writes an empty placeholder acknowledging the prop without resolving it", () => {
    const updated = applyPropResolution(baseConfig(), "Avatar", "user", { type: "placeholder" });

    expect(updated.components).toEqual({ Avatar: { props: { user: {} } } });
  });

  it("preserves sibling props and other components already configured", () => {
    const existing = baseConfig({
      components: {
        Avatar: { props: { size: { values: ["sm", "lg"] } } },
        Button: { props: { variant: { values: ["default"] } } },
      },
    });

    const updated = applyPropResolution(existing, "Avatar", "user", { type: "values", values: ["guest"] });

    expect(updated.components).toEqual({
      Avatar: { props: { size: { values: ["sm", "lg"] }, user: { values: ["guest"] } } },
      Button: { props: { variant: { values: ["default"] } } },
    });
  });

  it("preserves other configuration sections untouched", () => {
    const existing = baseConfig({ standards: ["rgaa4.1"], ignorePatterns: ["dist/"] });

    const updated = applyPropResolution(existing, "Avatar", "user", { type: "values", values: ["guest"] });

    expect(updated.standards).toEqual(["rgaa4.1"]);
    expect(updated.ignorePatterns).toEqual(["dist/"]);
  });

  it("does not mutate the input config", () => {
    const existing = baseConfig();

    applyPropResolution(existing, "Avatar", "user", { type: "values", values: ["guest"] });

    expect(existing.components).toBeUndefined();
  });
});

describe("applySkipComponent", () => {
  it("marks a component as explicitly skipped", () => {
    const updated = applySkipComponent(baseConfig(), "Avatar");

    expect(updated.components).toEqual({ Avatar: { skip: true } });
    expect(() => configSchema.parse(updated)).not.toThrow();
  });

  it("preserves already-configured props on the skipped component", () => {
    const existing = baseConfig({ components: { Avatar: { props: { size: { values: ["sm"] } } } } });

    const updated = applySkipComponent(existing, "Avatar");

    expect(updated.components).toEqual({ Avatar: { props: { size: { values: ["sm"] } }, skip: true } });
  });
});
