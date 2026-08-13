import { describe, expect, it } from "vitest";
import { DynamicParameterMissingError } from "../errors/dynamic-parameter-missing-error.js";
import { DynamicParameterUnknownError } from "../errors/dynamic-parameter-unknown-error.js";
import type { RawDynamicRoute } from "../types/route.js";
import { validateRouteParameters } from "./validate-route-parameters.js";

function dynamicRoute(overrides: Partial<RawDynamicRoute> = {}): RawDynamicRoute {
  return {
    id: "member-stay",
    path: "/member/stays/[stayId]",
    isDynamic: true,
    parameters: { stayId: "seed-stay-123" },
    enableSnapshot: true,
    ...overrides,
  };
}

describe("validateRouteParameters", () => {
  it("ne lève rien quand path et parameters correspondent", () => {
    expect(() => validateRouteParameters(dynamicRoute())).not.toThrow();
  });

  it("lève DYNAMIC_PARAMETER_MISSING même quand snapshotPath est fourni", () => {
    const route = dynamicRoute({ parameters: {}, snapshotPath: "/override" });

    expect(() => validateRouteParameters(route)).toThrow(DynamicParameterMissingError);
  });

  it("lève DYNAMIC_PARAMETER_UNKNOWN même quand snapshotPath est fourni", () => {
    const route = dynamicRoute({
      parameters: { stayId: "seed-stay-123", extra: "unused" },
      snapshotPath: "/override",
    });

    expect(() => validateRouteParameters(route)).toThrow(DynamicParameterUnknownError);
  });
});
