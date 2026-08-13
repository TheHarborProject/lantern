import { describe, expect, it } from "vitest";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import { createRouteFromDiscovery } from "./create-route-from-discovery.js";

function discoveredRoute(overrides: Partial<DiscoveredRoute> = {}): DiscoveredRoute {
  return {
    path: "/blog",
    filePath: "/project/app/blog/page.tsx",
    router: "app",
    isDynamic: false,
    ...overrides,
  };
}

describe("createRouteFromDiscovery", () => {
  it("crée une route statique sans 'parameters' ni 'isDynamic'", () => {
    const route = createRouteFromDiscovery(discoveredRoute(), new Set(), false);

    expect(route).toEqual({ id: "blog", path: "/blog", enableSnapshot: false });
  });

  it("une route statique respecte l'option --default", () => {
    const route = createRouteFromDiscovery(discoveredRoute(), new Set(), true);

    expect(route.enableSnapshot).toBe(true);
  });

  it("crée une route dynamique avec des paramètres placeholder", () => {
    const route = createRouteFromDiscovery(
      discoveredRoute({ path: "/stays/[stayId]", isDynamic: true }),
      new Set(),
      false,
    );

    expect(route).toEqual({
      id: "stays-stayId",
      path: "/stays/[stayId]",
      isDynamic: true,
      parameters: { stayId: "REPLACE_ME" },
      enableSnapshot: false,
    });
  });

  it("une route dynamique reste désactivée même avec --default=enabled (valeurs placeholder)", () => {
    const route = createRouteFromDiscovery(
      discoveredRoute({ path: "/stays/[stayId]", isDynamic: true }),
      new Set(),
      true,
    );

    expect(route.enableSnapshot).toBe(false);
  });

  it("évite les collisions d'id avec les identifiants déjà utilisés", () => {
    const route = createRouteFromDiscovery(discoveredRoute(), new Set(["blog"]), false);

    expect(route.id).toBe("blog-2");
  });
});
