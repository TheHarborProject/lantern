import { describe, expect, it } from "vitest";
import { componentsSchema } from "./components.js";

describe("componentsSchema", () => {
  it("accepts explicit prop values keyed by component name", () => {
    const parsed = componentsSchema.parse({
      Avatar: { props: { user: { values: ["guest", "member"] } } },
    });

    expect(parsed).toEqual({ Avatar: { props: { user: { values: ["guest", "member"] } } } });
  });

  it("accepts an empty component map", () => {
    expect(componentsSchema.parse({})).toEqual({});
  });

  it("accepts a component entry with no props declared", () => {
    expect(componentsSchema.parse({ Avatar: {} })).toEqual({ Avatar: {} });
  });

  it("rejects an unknown key on a component entry", () => {
    const result = componentsSchema.safeParse({ Avatar: { unknownField: true } });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown key on a prop entry", () => {
    const result = componentsSchema.safeParse({
      Avatar: { props: { user: { defaultValue: "guest" } } },
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-array values field", () => {
    const result = componentsSchema.safeParse({ Avatar: { props: { user: { values: "guest" } } } });

    expect(result.success).toBe(false);
  });
});
