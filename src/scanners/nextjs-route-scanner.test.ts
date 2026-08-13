import { describe, expect, it, vi } from "vitest";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import { NextjsRouteScanner } from "./nextjs-route-scanner.js";
import type { RouteScanner } from "./scanner.js";

const sampleRoute: DiscoveredRoute = {
  path: "/blog",
  filePath: "/project/app/blog/page.tsx",
  router: "app",
  isDynamic: false,
};

describe("NextjsRouteScanner", () => {
  it("délègue au moteur fourni au constructeur", async () => {
    const scanSpy = vi.fn().mockResolvedValue([sampleRoute]);
    const engine: RouteScanner = { scan: scanSpy };
    const scanner = new NextjsRouteScanner(engine);

    const result = await scanner.scan("/project");

    expect(result).toEqual([sampleRoute]);
    expect(scanSpy).toHaveBeenCalledWith("/project");
  });

  it("utilise FilesystemRouteScanner par défaut si aucun moteur n'est fourni", async () => {
    const scanner = new NextjsRouteScanner();

    // Aucun app/pages dans le répertoire courant du process de test : le
    // moteur par défaut ne doit pas lever d'erreur, seulement retourner [].
    await expect(scanner.scan("/tmp/does-not-exist-snaprun")).resolves.toEqual([]);
  });
});
