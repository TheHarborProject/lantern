import { describe, expect, it } from "vitest";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import { normalizeDiscoveredRoutes } from "./normalize-discovered-routes.js";

function route(overrides: Partial<DiscoveredRoute> = {}): DiscoveredRoute {
  return {
    path: "/blog",
    filePath: "/project/app/blog/page.tsx",
    router: "app",
    isDynamic: false,
    ...overrides,
  };
}

describe("normalizeDiscoveredRoutes", () => {
  it("trie les routes par chemin, de façon déterministe", () => {
    const result = normalizeDiscoveredRoutes([
      route({ path: "/zeta" }),
      route({ path: "/alpha" }),
      route({ path: "/beta" }),
    ]);

    expect(result.map((r) => r.path)).toEqual(["/alpha", "/beta", "/zeta"]);
  });

  it("déduplique par chemin, l'App Router l'emportant sur le Pages Router", () => {
    const result = normalizeDiscoveredRoutes([
      route({ path: "/blog", router: "pages", filePath: "/project/pages/blog.tsx" }),
      route({ path: "/blog", router: "app", filePath: "/project/app/blog/page.tsx" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.router).toBe("app");
  });

  it("l'App Router l'emporte quelle que soit l'ordre d'entrée", () => {
    const result = normalizeDiscoveredRoutes([
      route({ path: "/blog", router: "app", filePath: "/project/app/blog/page.tsx" }),
      route({ path: "/blog", router: "pages", filePath: "/project/pages/blog.tsx" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.router).toBe("app");
  });

  it("retourne [] pour une entrée vide", () => {
    expect(normalizeDiscoveredRoutes([])).toEqual([]);
  });
});
