import { describe, expect, it } from "vitest";
import { configSchema } from "./config.js";

describe("configSchema", () => {
  it("applies safe project defaults", () => {
    expect(configSchema.parse({ project: {} })).toEqual({
      project: { root: ".", workingDirectory: ".", autoStart: false },
    });
  });

  it("rejects configuration without a project section", () => {
    expect(configSchema.safeParse({}).success).toBe(false);
  });

  it("accepts optional form authentication", () => {
    const result = configSchema.safeParse({
      project: {},
      auth: {
        loginRoute: "/login",
        selectors: { email: "#email", password: "#password", submit: "button" },
        successSelector: "[data-authenticated]",
        users: { member: { email: "member@example.com", password: "${PASSWORD}" } },
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts the full RFC-005 accessibility configuration alongside isolation", () => {
    const result = configSchema.safeParse({
      project: {},
      isolation: { wrapper: "lantern/isolation-wrapper.tsx" },
      standards: ["wcag22-aa", "rgaa4.1"],
      extends: ["lantern:recommended"],
      engines: { axe: true },
      settings: { locale: "fr-FR" },
      rules: { "lantern/keyboard-access": ["error", { requireNativeSemantics: true }] },
      components: { Avatar: { props: { user: { values: ["guest", "member"] } } } },
      overrides: [
        { files: ["src/components/internal/**"], rules: { "lantern/focus-visible": "off" } },
      ],
      ignorePatterns: ["node_modules/", "dist/"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown top-level key", () => {
    const result = configSchema.safeParse({ project: {}, output: { fullPage: true } });

    expect(result.success).toBe(false);
  });

  it("rejects malformed standards nested in a full configuration", () => {
    const result = configSchema.safeParse({ project: {}, standards: ["not-a-standard"] });

    expect(result.success).toBe(false);
  });

  it("rejects malformed rule severities nested in a full configuration", () => {
    const result = configSchema.safeParse({
      project: {},
      rules: { "lantern/accessible-name": "critical" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed engines nested in a full configuration", () => {
    const result = configSchema.safeParse({ project: {}, engines: { axe: "on" } });

    expect(result.success).toBe(false);
  });

  it("rejects malformed overrides nested in a full configuration", () => {
    const result = configSchema.safeParse({ project: {}, overrides: [{ rules: {} }] });

    expect(result.success).toBe(false);
  });

  it("rejects malformed component configuration nested in a full configuration", () => {
    const result = configSchema.safeParse({
      project: {},
      components: { Avatar: { props: { user: { values: "guest" } } } },
    });

    expect(result.success).toBe(false);
  });
});
