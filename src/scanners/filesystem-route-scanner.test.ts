import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemRouteScanner } from "./filesystem-route-scanner.js";

function writeFile(
  dir: string,
  relativePath: string,
  content = "export default function Page() {}",
): void {
  const fullPath = join(dir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

describe("FilesystemRouteScanner", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-filesystem-scanner-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("scanne app/ quand il existe", async () => {
    writeFile(dir, "app/page.tsx");
    writeFile(dir, "app/blog/page.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes.map((r) => r.path)).toEqual(["/", "/blog"]);
  });

  it("se rabat sur src/app quand app/ n'existe pas", async () => {
    writeFile(dir, "src/app/page.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes.map((r) => r.path)).toEqual(["/"]);
  });

  it("se rabat sur src/pages quand pages/ n'existe pas", async () => {
    writeFile(dir, "src/pages/about.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes.map((r) => r.path)).toEqual(["/about"]);
  });

  it("scanne App Router et Pages Router simultanément (migration incrémentale)", async () => {
    writeFile(dir, "app/blog/page.tsx");
    writeFile(dir, "pages/about.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes.map((r) => r.path)).toEqual(["/about", "/blog"]);
  });

  it("l'App Router l'emporte sur le Pages Router pour un chemin identique", async () => {
    writeFile(dir, "app/blog/page.tsx");
    writeFile(dir, "pages/blog.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.router).toBe("app");
  });

  it("retourne [] si ni app/ ni pages/ n'existent", async () => {
    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes).toEqual([]);
  });

  it("retourne une sortie triée de façon stable", async () => {
    writeFile(dir, "app/zeta/page.tsx");
    writeFile(dir, "app/alpha/page.tsx");
    writeFile(dir, "app/beta/page.tsx");

    const routes = await new FilesystemRouteScanner().scan(dir);

    expect(routes.map((r) => r.path)).toEqual(["/alpha", "/beta", "/zeta"]);
  });
});
