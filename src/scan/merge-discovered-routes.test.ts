import { describe, expect, it } from "vitest";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import type { RawStaticRoute } from "../types/route.js";
import { mergeDiscoveredRoutes } from "./merge-discovered-routes.js";

function discoveredRoute(path: string, isDynamic = false): DiscoveredRoute {
  return { path, filePath: `/project/app${path}/page.tsx`, router: "app", isDynamic };
}

function existingRoute(overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
  return { id: "custom-id", path: "/blog", enableSnapshot: true, user: "member", ...overrides };
}

describe("mergeDiscoveredRoutes", () => {
  it("ajoute une route découverte sans correspondance existante", () => {
    const result = mergeDiscoveredRoutes([], [discoveredRoute("/blog")], false);

    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.path).toBe("/blog");
    expect(result.unchanged).toEqual([]);
    expect(result.obsolete).toEqual([]);
  });

  it("préserve intégralement une route existante retrouvée (id, options, ordre)", () => {
    const existing = existingRoute({ snapshotPath: "/blog/override" });

    const result = mergeDiscoveredRoutes([existing], [discoveredRoute("/blog")], false);

    expect(result.added).toEqual([]);
    expect(result.unchanged).toEqual([existing]);
    expect(result.mergedRoutes).toEqual([existing]);
  });

  it("signale une route existante non retrouvée comme obsolète, sans la supprimer", () => {
    const existing = existingRoute({ path: "/gone" });

    const result = mergeDiscoveredRoutes([existing], [], false);

    expect(result.obsolete).toEqual([existing]);
    expect(result.mergedRoutes).toEqual([existing]);
  });

  it("ajoute les nouvelles routes à la fin, sans réordonner les routes existantes", () => {
    const first = existingRoute({ id: "first", path: "/first" });
    const second = existingRoute({ id: "second", path: "/second" });

    const result = mergeDiscoveredRoutes(
      [second, first],
      [discoveredRoute("/first"), discoveredRoute("/second"), discoveredRoute("/third")],
      false,
    );

    expect(result.mergedRoutes.map((r) => r.path)).toEqual(["/second", "/first", "/third"]);
  });

  it("est idempotent : une deuxième fusion sans changement filesystem n'ajoute rien", () => {
    const firstPass = mergeDiscoveredRoutes([], [discoveredRoute("/blog")], false);

    const secondPass = mergeDiscoveredRoutes(
      firstPass.mergedRoutes,
      [discoveredRoute("/blog")],
      false,
    );

    expect(secondPass.added).toEqual([]);
    expect(secondPass.unchanged).toEqual(firstPass.mergedRoutes);
    expect(secondPass.mergedRoutes).toEqual(firstPass.mergedRoutes);
  });

  it("évite les collisions d'id entre routes ajoutées et routes existantes", () => {
    const existing = existingRoute({ id: "blog", path: "/blog-legacy" });

    const result = mergeDiscoveredRoutes([existing], [discoveredRoute("/blog")], false);

    expect(result.added[0]?.id).toBe("blog-2");
  });

  it("ne crée pas d'entrée 'routes' pour une route catch-all requise, la signale comme non prise en charge", () => {
    const discovered = discoveredRoute("/docs/[...slug]", true);

    const result = mergeDiscoveredRoutes([], [discovered], false);

    expect(result.added).toEqual([]);
    expect(result.mergedRoutes).toEqual([]);
    expect(result.unsupportedCatchAll).toEqual([discovered]);
  });

  it("ne crée pas d'entrée 'routes' pour une route catch-all optionnelle, la signale comme non prise en charge", () => {
    const discovered = discoveredRoute("/shop/[[...slug]]", true);

    const result = mergeDiscoveredRoutes([], [discovered], false);

    expect(result.added).toEqual([]);
    expect(result.mergedRoutes).toEqual([]);
    expect(result.unsupportedCatchAll).toEqual([discovered]);
  });

  it("ne signale pas une route catch-all déjà configurée manuellement comme non prise en charge", () => {
    const existing = existingRoute({ id: "docs", path: "/docs/[...slug]" });

    const result = mergeDiscoveredRoutes(
      [existing],
      [discoveredRoute("/docs/[...slug]", true)],
      false,
    );

    expect(result.unchanged).toEqual([existing]);
    expect(result.unsupportedCatchAll).toEqual([]);
  });

  it("reste idempotent avec des routes catch-all non prises en charge", () => {
    const discovered = discoveredRoute("/docs/[...slug]", true);

    const firstPass = mergeDiscoveredRoutes([], [discovered], false);
    const secondPass = mergeDiscoveredRoutes(firstPass.mergedRoutes, [discovered], false);

    expect(secondPass.added).toEqual([]);
    expect(secondPass.unsupportedCatchAll).toEqual([discovered]);
    expect(secondPass.mergedRoutes).toEqual([]);
  });
});
