import { describe, expect, it } from "vitest";
import { DynamicParameterMissingError } from "../errors/dynamic-parameter-missing-error.js";
import { DynamicParameterUnknownError } from "../errors/dynamic-parameter-unknown-error.js";
import type { RawDynamicRoute, RawStaticRoute } from "../types/route.js";
import { resolveRoutePath } from "./resolve-route-path.js";

function staticRoute(overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
  return {
    id: "member-calendar",
    path: "/member/calendar",
    enableSnapshot: true,
    user: "member",
    ...overrides,
  };
}

function dynamicRoute(overrides: Partial<RawDynamicRoute> = {}): RawDynamicRoute {
  return {
    id: "member-stay",
    path: "/member/stays/[stayId]",
    isDynamic: true,
    parameters: { stayId: "seed-stay-123" },
    enableSnapshot: true,
    user: "member",
    ...overrides,
  };
}

describe("resolveRoutePath", () => {
  it("retourne 'path' pour une route statique sans override", () => {
    expect(resolveRoutePath(staticRoute())).toBe("/member/calendar");
  });

  it("retourne 'snapshotPath' pour une route statique quand il est fourni", () => {
    const route = staticRoute({ snapshotPath: "/member/calendar/2024-01" });

    expect(resolveRoutePath(route)).toBe("/member/calendar/2024-01");
  });

  it("substitue un unique paramètre dynamique", () => {
    expect(resolveRoutePath(dynamicRoute())).toBe("/member/stays/seed-stay-123");
  });

  it("substitue plusieurs paramètres dynamiques", () => {
    const route = dynamicRoute({
      path: "/orgs/[orgId]/members/[memberId]",
      parameters: { orgId: "org-1", memberId: "member-1" },
    });

    expect(resolveRoutePath(route)).toBe("/orgs/org-1/members/member-1");
  });

  it("encode les valeurs de paramètres pour l'URL", () => {
    const route = dynamicRoute({ parameters: { stayId: "un été à Paris/2024" } });

    expect(resolveRoutePath(route)).toBe(
      `/member/stays/${encodeURIComponent("un été à Paris/2024")}`,
    );
  });

  it("utilise snapshotPath comme URL finale quand parameters est cohérent avec path", () => {
    const route = dynamicRoute({ snapshotPath: "/member/stays/override" });

    expect(resolveRoutePath(route)).toBe("/member/stays/override");
  });

  it("rejette un paramètre requis manquant même quand snapshotPath est fourni", () => {
    // path référence [stayId], absent de parameters : snapshotPath ne
    // dispense pas de la validation du modèle (RFC-004, correction post-revue).
    const route = dynamicRoute({
      parameters: {},
      snapshotPath: "/member/stays/override",
    });

    try {
      resolveRoutePath(route);
      expect.fail("resolveRoutePath aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicParameterMissingError);
      expect((error as DynamicParameterMissingError).parameterName).toBe("stayId");
    }
  });

  it("rejette un paramètre inconnu même quand snapshotPath est fourni", () => {
    // 'extra' n'est référencé nulle part dans path : rejeté malgré
    // snapshotPath, qui ne remplace que l'URL finale visitée.
    const route = dynamicRoute({
      parameters: { stayId: "seed-stay-123", extra: "unused" },
      snapshotPath: "/member/stays/override",
    });

    try {
      resolveRoutePath(route);
      expect.fail("resolveRoutePath aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicParameterUnknownError);
      expect((error as DynamicParameterUnknownError).parameterName).toBe("extra");
    }
  });

  it("lève DYNAMIC_PARAMETER_MISSING si un segment [param] n'a pas de valeur", () => {
    const route = dynamicRoute({ parameters: {} });

    try {
      resolveRoutePath(route);
      expect.fail("resolveRoutePath aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicParameterMissingError);
      const missingError = error as DynamicParameterMissingError;
      expect(missingError.code).toBe("DYNAMIC_PARAMETER_MISSING");
      expect(missingError.routeId).toBe("member-stay");
      expect(missingError.parameterName).toBe("stayId");
    }
  });

  it("lève DYNAMIC_PARAMETER_UNKNOWN si 'parameters' contient une clé non référencée dans path", () => {
    const route = dynamicRoute({ parameters: { stayId: "seed-stay-123", extra: "unused" } });

    try {
      resolveRoutePath(route);
      expect.fail("resolveRoutePath aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(DynamicParameterUnknownError);
      const unknownError = error as DynamicParameterUnknownError;
      expect(unknownError.code).toBe("DYNAMIC_PARAMETER_UNKNOWN");
      expect(unknownError.routeId).toBe("member-stay");
      expect(unknownError.parameterName).toBe("extra");
    }
  });
});
