import { describe, expect, it } from "vitest";
import { inferPropType } from "./infer-prop-type.js";

describe("inferPropType", () => {
  it("infers a required boolean", () => {
    expect(inferPropType("boolean")).toEqual({ kind: "boolean" });
  });

  it("infers an optional boolean (printed with | undefined)", () => {
    expect(inferPropType("boolean | undefined")).toEqual({ kind: "boolean" });
  });

  it("infers a bare true/false literal union as boolean", () => {
    expect(inferPropType("true | false")).toEqual({ kind: "boolean" });
  });

  it("infers a finite string literal union", () => {
    expect(inferPropType('"default" | "outline" | "destructive"')).toEqual({
      kind: "literal-union",
      values: ["default", "outline", "destructive"],
    });
  });

  it("infers a nullable finite literal union, including null", () => {
    expect(inferPropType('"sm" | "md" | "lg" | null')).toEqual({
      kind: "literal-union",
      values: ["sm", "md", "lg", null],
    });
  });

  it("infers an optional finite literal union (drops the undefined marker)", () => {
    expect(inferPropType('"info" | "warning" | undefined')).toEqual({
      kind: "literal-union",
      values: ["info", "warning"],
    });
  });

  it("infers a numeric literal union", () => {
    expect(inferPropType("1 | 2 | 3")).toEqual({ kind: "literal-union", values: [1, 2, 3] });
  });

  it("deduplicates repeated literal members", () => {
    expect(inferPropType('"sm" | "sm" | "lg"')).toEqual({
      kind: "literal-union",
      values: ["sm", "lg"],
    });
  });

  it("does not infer an open string type", () => {
    expect(inferPropType("string")).toEqual({ kind: "unsafe" });
  });

  it("does not infer an open number type", () => {
    expect(inferPropType("number")).toEqual({ kind: "unsafe" });
  });

  it("does not infer a mixed literal/open union", () => {
    expect(inferPropType('"sm" | "lg" | string')).toEqual({ kind: "unsafe" });
  });

  it("does not infer function/handler types", () => {
    expect(inferPropType("() => void")).toEqual({ kind: "unsafe" });
    expect(inferPropType("(event: MouseEvent) => void")).toEqual({ kind: "unsafe" });
  });

  it("does not infer ReactNode or other domain/open types", () => {
    expect(inferPropType("ReactNode")).toEqual({ kind: "unsafe" });
    expect(inferPropType("User")).toEqual({ kind: "unsafe" });
    expect(inferPropType("Record<string, unknown>")).toEqual({ kind: "unsafe" });
    expect(inferPropType("Promise<void>")).toEqual({ kind: "unsafe" });
  });
});
