import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverAppRoutes } from "./discover-app-routes.js";

function writeFile(
  dir: string,
  relativePath: string,
  content = "export default function Page() {}",
): void {
  const fullPath = join(dir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("discoverAppRoutes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-discover-app-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("détecte la page racine", async () => {
    writeFile(dir, "page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes).toEqual([
      { path: "/", filePath: join(dir, "page.tsx"), router: "app", isDynamic: false },
    ]);
  });

  it("détecte une page imbriquée", async () => {
    writeFile(dir, "blog/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes[0]?.path).toBe("/blog");
  });

  it("exclut layout, loading, error, template, default, route, not-found, global-error", async () => {
    writeFile(dir, "blog/page.tsx");
    writeFile(dir, "blog/layout.tsx");
    writeFile(dir, "blog/loading.tsx");
    writeFile(dir, "blog/error.tsx");
    writeFile(dir, "blog/template.tsx");
    writeFile(dir, "blog/default.tsx");
    writeFile(dir, "blog/route.ts");
    writeFile(dir, "blog/not-found.tsx");
    writeFile(dir, "blog/global-error.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe("/blog");
  });

  it("retire les route groups de l'URL tout en parcourant leur contenu", async () => {
    writeFile(dir, "(marketing)/about/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes[0]?.path).toBe("/about");
  });

  it("détecte un segment dynamique [id]", async () => {
    writeFile(dir, "stays/[stayId]/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes[0]?.path).toBe("/stays/[stayId]");
    expect(routes[0]?.isDynamic).toBe(true);
  });

  it("détecte un segment catch-all [...slug]", async () => {
    writeFile(dir, "docs/[...slug]/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes[0]?.path).toBe("/docs/[...slug]");
    expect(routes[0]?.isDynamic).toBe(true);
  });

  it("détecte un segment catch-all optionnel [[...slug]]", async () => {
    writeFile(dir, "shop/[[...slug]]/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes[0]?.path).toBe("/shop/[[...slug]]");
    expect(routes[0]?.isDynamic).toBe(true);
  });

  it("ignore les dossiers privés (préfixe _) et les slots parallèles (préfixe @)", async () => {
    writeFile(dir, "blog/page.tsx");
    writeFile(dir, "_components/button.tsx");
    writeFile(dir, "@modal/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe("/blog");
  });

  it("exclut entièrement les routes interceptantes (.), (..), (..)(..), (...)", async () => {
    writeFile(dir, "feed/page.tsx");
    writeFile(dir, "feed/(.)photo/[id]/page.tsx");
    writeFile(dir, "(..)modal/page.tsx");
    writeFile(dir, "feed/(..)(..)profile/page.tsx");
    writeFile(dir, "(...)modal/page.tsx");

    const routes = await discoverAppRoutes(dir);

    expect(routes).toEqual([
      { path: "/feed", filePath: join(dir, "feed", "page.tsx"), router: "app", isDynamic: false },
    ]);

    for (const route of routes) {
      expect(route.path).not.toContain("(.)");
      expect(route.path).not.toContain("(..)");
      expect(route.path).not.toContain("(...)");
    }
  });

  it("n'introduit aucun segment (.)photo ou (..)modal dans les chemins découverts", async () => {
    writeFile(dir, "page.tsx");
    writeFile(dir, "(.)photo/page.tsx");
    writeFile(dir, "(..)modal/nested/page.tsx");

    const routes = await discoverAppRoutes(dir);
    const paths = routes.map((route) => route.path);

    expect(paths).not.toContain("/(.)photo");
    expect(paths).not.toContain("/(..)modal/nested");
    expect(paths.some((path) => path.includes("(.)photo"))).toBe(false);
    expect(paths.some((path) => path.includes("(..)modal"))).toBe(false);
  });
});
