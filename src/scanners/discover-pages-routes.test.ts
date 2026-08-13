import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverPagesRoutes } from "./discover-pages-routes.js";

function writeFile(
  dir: string,
  relativePath: string,
  content = "export default function Page() {}",
): void {
  const fullPath = join(dir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("discoverPagesRoutes", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-discover-pages-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("détecte index.tsx comme page racine", async () => {
    writeFile(dir, "index.tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes).toEqual([
      { path: "/", filePath: join(dir, "index.tsx"), router: "pages", isDynamic: false },
    ]);
  });

  it("détecte une page fichier direct", async () => {
    writeFile(dir, "about.tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes[0]?.path).toBe("/about");
  });

  it("détecte index.tsx d'un dossier comme chemin du dossier parent", async () => {
    writeFile(dir, "blog/index.tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes[0]?.path).toBe("/blog");
  });

  it("exclut _app, _document, _error, _middleware", async () => {
    writeFile(dir, "index.tsx");
    writeFile(dir, "_app.tsx");
    writeFile(dir, "_document.tsx");
    writeFile(dir, "_error.tsx");
    writeFile(dir, "_middleware.ts");

    const routes = await discoverPagesRoutes(dir);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe("/");
  });

  it("exclut le dossier racine api/ (routes API)", async () => {
    writeFile(dir, "index.tsx");
    writeFile(dir, "api/users.ts");

    const routes = await discoverPagesRoutes(dir);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe("/");
  });

  it("détecte un segment dynamique [id] au niveau fichier", async () => {
    writeFile(dir, "blog/[slug].tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes[0]?.path).toBe("/blog/[slug]");
    expect(routes[0]?.isDynamic).toBe(true);
  });

  it("détecte un segment catch-all [...slug] au niveau dossier", async () => {
    writeFile(dir, "docs/[...slug]/index.tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes[0]?.path).toBe("/docs/[...slug]");
    expect(routes[0]?.isDynamic).toBe(true);
  });

  it("détecte un segment catch-all optionnel [[...slug]]", async () => {
    writeFile(dir, "shop/[[...slug]].tsx");

    const routes = await discoverPagesRoutes(dir);

    expect(routes[0]?.path).toBe("/shop/[[...slug]]");
    expect(routes[0]?.isDynamic).toBe(true);
  });
});
