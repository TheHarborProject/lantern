import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { configSchema } from "../schemas/config.js";
import { resolveConfigPaths } from "./resolve-config-paths.js";

describe("resolveConfigPaths", () => {
  it("resolves the accessibility configuration alongside project paths", () => {
    const raw = configSchema.parse({
      project: { root: "." },
      standards: ["rgaa4.1"],
      extends: ["lantern:recommended"],
      rules: { "lantern/color-contrast": "warn" },
    });

    const resolved = resolveConfigPaths(raw, join("/tmp", "app", "lantern.config.json"));

    expect(resolved.project.root).toBe(join("/tmp", "app"));
    expect(resolved.standards).toEqual(["rgaa4.1"]);
    expect(resolved.rules).toEqual({
      "lantern/color-contrast": "warn",
      "lantern/accessible-name": "error",
      "lantern/focus-visible": "warn",
      "lantern/keyboard-access": "error",
    });
    expect(resolved.engines).toEqual({ static: true, rendered: true, axe: false, lighthouse: false });
  });

  it("treats .lantern/config.json as rooted in its containing project", () => {
    const raw = configSchema.parse({ project: { startScript: "dev" } });

    const resolved = resolveConfigPaths(raw, join("/tmp", "app", ".lantern", "config.json"));

    expect(resolved.project.root).toBe(join("/tmp", "app"));
    expect(resolved.project.workingDirectory).toBe(join("/tmp", "app"));
    expect(resolved.project.sourceDirectory).toBe(join("/tmp", "app"));
  });

  it("resolves project.sourceDirectory relative to project.root", () => {
    const raw = configSchema.parse({ project: { root: "./app", sourceDirectory: "src/components" } });

    const resolved = resolveConfigPaths(raw, join("/tmp", "project", "lantern.config.json"));

    expect(resolved.project.sourceDirectory).toBe(join("/tmp", "project", "app", "src", "components"));
  });

  it("stays compatible with existing isolation and auth configuration", () => {
    const raw = configSchema.parse({
      project: { root: "." },
      isolation: { wrapper: "lantern/isolation-wrapper.tsx" },
      auth: {
        loginRoute: "/sign-in",
        selectors: { email: "#email", password: "#password", submit: "button" },
        successUrl: "/dashboard",
        users: {},
      },
    });

    const resolved = resolveConfigPaths(raw, join("/tmp", "app", "lantern.config.json"));

    expect(resolved.isolation).toEqual({
      globalCss: [],
      wrapper: "lantern/isolation-wrapper.tsx",
      wrapperExport: "default",
    });
    expect(resolved.auth?.loginRoute).toBe("/sign-in");
    expect(resolved.standards).toEqual(["wcag22-aa"]);
  });

  it("leaves auth and isolation undefined when not configured", () => {
    const raw = configSchema.parse({ project: { root: "." } });

    const resolved = resolveConfigPaths(raw, join("/tmp", "app", "lantern.config.json"));

    expect(resolved.auth).toBeUndefined();
    expect(resolved.isolation).toBeUndefined();
  });

  it("resolves ignorePatterns for discovery integration", () => {
    const raw = configSchema.parse({
      project: { root: "." },
      ignorePatterns: ["node_modules/", "dist/"],
    });

    const resolved = resolveConfigPaths(raw, join("/tmp", "app", "lantern.config.json"));

    expect(resolved.ignorePatterns).toEqual(["node_modules/", "dist/"]);
  });
});
