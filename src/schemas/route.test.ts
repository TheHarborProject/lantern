import { describe, expect, it } from "vitest";
import { routeSchema, routesSchema } from "./route.js";

function staticRoute(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "member-calendar",
    path: "/member/calendar",
    enableSnapshot: true,
    user: "member",
    ...overrides,
  };
}

function dynamicRoute(overrides: Record<string, unknown> = {}): unknown {
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

describe("routeSchema", () => {
  it("accepte une route statique", () => {
    expect(routeSchema.safeParse(staticRoute()).success).toBe(true);
  });

  it("accepte une route statique avec isDynamic: false explicite", () => {
    expect(routeSchema.safeParse(staticRoute({ isDynamic: false })).success).toBe(true);
  });

  it("accepte une route dynamique avec un ou plusieurs paramètres", () => {
    const multiParam = dynamicRoute({
      path: "/orgs/[orgId]/members/[memberId]",
      parameters: { orgId: "org-1", memberId: "member-1" },
    });

    expect(routeSchema.safeParse(multiParam).success).toBe(true);
  });

  it("accepte snapshotPath comme override", () => {
    expect(
      routeSchema.safeParse(staticRoute({ snapshotPath: "/member/calendar/2024-01" })).success,
    ).toBe(true);
  });

  it("rejette une route statique portant 'parameters' (clé inconnue pour ce variant)", () => {
    expect(routeSchema.safeParse(staticRoute({ parameters: { foo: "bar" } })).success).toBe(false);
  });

  it("rejette une route dynamique sans 'parameters'", () => {
    const route = dynamicRoute();
    delete (route as Record<string, unknown>)["parameters"];

    expect(routeSchema.safeParse(route).success).toBe(false);
  });

  it("rejette une clé inconnue (validation stricte)", () => {
    expect(routeSchema.safeParse(staticRoute({ unexpected: "value" })).success).toBe(false);
  });

  it("rejette un type invalide (enableSnapshot non booléen)", () => {
    expect(routeSchema.safeParse(staticRoute({ enableSnapshot: "oui" })).success).toBe(false);
  });

  it("rejette une route dynamique dont 'parameters' ne correspond pas à 'path', même avec snapshotPath", () => {
    // Exemple signalé en revue : snapshotPath permettrait techniquement la
    // navigation, mais 'wrongId' ne correspond à aucun segment de path (qui
    // attend 'stayId') : la cohérence structurelle doit être rejetée.
    const invalidExample = {
      id: "member-stay",
      path: "/member/stays/[stayId]",
      isDynamic: true,
      parameters: { wrongId: "123" },
      snapshotPath: "/member/stays/123",
      enableSnapshot: true,
    };

    expect(routeSchema.safeParse(invalidExample).success).toBe(false);
  });

  it("accepte une route dynamique cohérente avec snapshotPath", () => {
    const route = dynamicRoute({ snapshotPath: "/member/stays/override" });

    expect(routeSchema.safeParse(route).success).toBe(true);
  });
});

describe("routesSchema", () => {
  it("accepte une liste de routes aux identifiants uniques", () => {
    const result = routesSchema.safeParse([staticRoute({ id: "a" }), dynamicRoute({ id: "b" })]);

    expect(result.success).toBe(true);
  });

  it("rejette une liste de routes avec un identifiant dupliqué", () => {
    const result = routesSchema.safeParse([
      staticRoute({ id: "duplicate" }),
      dynamicRoute({ id: "duplicate" }),
    ]);

    expect(result.success).toBe(false);
  });

  it("accepte une liste vide", () => {
    const result = routesSchema.safeParse([]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});
