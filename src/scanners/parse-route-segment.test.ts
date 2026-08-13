import { describe, expect, it } from "vitest";
import {
  isDynamicSegment,
  isInterceptingRouteSegment,
  isRouteGroupSegment,
  parseRouteSegment,
} from "./parse-route-segment.js";

describe("parseRouteSegment", () => {
  it("classifie un segment statique", () => {
    expect(parseRouteSegment("blog")).toEqual({ kind: "static" });
  });

  it("classifie un segment dynamique [id]", () => {
    expect(parseRouteSegment("[id]")).toEqual({ kind: "dynamic" });
  });

  it("classifie un segment catch-all [...slug]", () => {
    expect(parseRouteSegment("[...slug]")).toEqual({ kind: "catch-all" });
  });

  it("classifie un segment catch-all optionnel [[...slug]]", () => {
    expect(parseRouteSegment("[[...slug]]")).toEqual({ kind: "optional-catch-all" });
  });

  it("ne confond pas un route group avec un segment dynamique", () => {
    expect(parseRouteSegment("(marketing)")).toEqual({ kind: "static" });
  });
});

describe("isDynamicSegment", () => {
  it("est faux pour un segment statique", () => {
    expect(isDynamicSegment("blog")).toBe(false);
  });

  it("est vrai pour dynamique, catch-all et catch-all optionnel", () => {
    expect(isDynamicSegment("[id]")).toBe(true);
    expect(isDynamicSegment("[...slug]")).toBe(true);
    expect(isDynamicSegment("[[...slug]]")).toBe(true);
  });
});

describe("isRouteGroupSegment", () => {
  it("reconnaît un route group", () => {
    expect(isRouteGroupSegment("(marketing)")).toBe(true);
  });

  it("rejette un segment statique ou dynamique", () => {
    expect(isRouteGroupSegment("blog")).toBe(false);
    expect(isRouteGroupSegment("[id]")).toBe(false);
  });
});

describe("isInterceptingRouteSegment", () => {
  it("reconnaît les quatre marqueurs de route interceptante", () => {
    expect(isInterceptingRouteSegment("(.)photo")).toBe(true);
    expect(isInterceptingRouteSegment("(..)modal")).toBe(true);
    expect(isInterceptingRouteSegment("(..)(..)feed")).toBe(true);
    expect(isInterceptingRouteSegment("(...)modal")).toBe(true);
  });

  it("rejette un segment statique, dynamique ou un route group", () => {
    expect(isInterceptingRouteSegment("blog")).toBe(false);
    expect(isInterceptingRouteSegment("[id]")).toBe(false);
    expect(isInterceptingRouteSegment("(marketing)")).toBe(false);
  });
});
