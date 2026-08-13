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
});
