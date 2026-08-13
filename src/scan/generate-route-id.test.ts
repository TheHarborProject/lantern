import { describe, expect, it } from "vitest";
import { generateRouteId } from "./generate-route-id.js";

describe("generateRouteId", () => {
  it("génère un id à partir des segments du chemin", () => {
    expect(generateRouteId("/blog/archive", new Set())).toBe("blog-archive");
  });

  it("génère 'home' pour le chemin racine", () => {
    expect(generateRouteId("/", new Set())).toBe("home");
  });

  it("retire les crochets d'un segment dynamique", () => {
    expect(generateRouteId("/stays/[stayId]", new Set())).toBe("stays-stayId");
  });

  it("retire la syntaxe catch-all et catch-all optionnel", () => {
    expect(generateRouteId("/docs/[...slug]", new Set())).toBe("docs-slug");
    expect(generateRouteId("/shop/[[...slug]]", new Set())).toBe("shop-slug");
  });

  it("ajoute un suffixe numérique en cas de collision", () => {
    const usedIds = new Set(["blog"]);

    expect(generateRouteId("/blog", usedIds)).toBe("blog-2");
  });

  it("incrémente le suffixe tant que la collision persiste", () => {
    const usedIds = new Set(["blog", "blog-2", "blog-3"]);

    expect(generateRouteId("/blog", usedIds)).toBe("blog-4");
  });
});
