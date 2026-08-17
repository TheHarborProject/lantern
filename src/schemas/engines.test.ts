import { describe, expect, it } from "vitest";
import { enginesSchema } from "./engines.js";

describe("enginesSchema", () => {
  it("defaults to the Lantern-owned engines enabled", () => {
    expect(enginesSchema.parse({})).toEqual({ static: true, rendered: true, axe: false, lighthouse: false });
  });

  it("allows enabling/disabling individual engines without touching the others", () => {
    expect(enginesSchema.parse({ axe: true })).toEqual({ static: true, rendered: true, axe: true, lighthouse: false });
  });

  it("rejects unknown engine keys", () => {
    const result = enginesSchema.safeParse({ lighthouse: true, puppeteer: true });

    expect(result.success).toBe(false);
  });

  it("rejects non-boolean engine values", () => {
    const result = enginesSchema.safeParse({ axe: "true" });

    expect(result.success).toBe(false);
  });
});
