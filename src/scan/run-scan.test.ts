import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import { runScan } from "./run-scan.js";

function fakeScanner(routes: DiscoveredRoute[]): { scan: () => Promise<DiscoveredRoute[]> } {
  return { scan: () => Promise.resolve(routes) };
}

function discoveredRoute(path: string, isDynamic = false): DiscoveredRoute {
  return { path, filePath: `/project/app${path}/page.tsx`, router: "app", isDynamic };
}

describe("runScan", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-run-scan-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(config: Record<string, unknown>): string {
    const configPath = join(dir, "snaprun.config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  it("ajoute les nouvelles routes découvertes et écrit le fichier", async () => {
    writeConfig({ project: {}, routes: [] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    expect(result.added).toHaveLength(1);
    expect(result.fileModified).toBe(true);

    const written = JSON.parse(readFileSync(result.configFilePath, "utf-8")) as {
      routes: unknown[];
    };
    expect(written.routes).toHaveLength(1);
  });

  it("préserve les options d'une route existante (id, enableSnapshot, user, parameters, snapshotPath)", async () => {
    const existingRoute = {
      id: "custom-blog-id",
      path: "/blog",
      enableSnapshot: true,
      user: "member",
      snapshotPath: "/blog/override",
    };
    writeConfig({ project: {}, routes: [existingRoute] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    expect(result.added).toEqual([]);
    expect(result.unchanged).toEqual([existingRoute]);
    expect(result.fileModified).toBe(false);
  });

  it("ne réécrit pas le fichier si aucune route n'est ajoutée (idempotence)", async () => {
    const configPath = writeConfig({
      project: {},
      routes: [{ id: "blog", path: "/blog", enableSnapshot: false }],
    });
    const mtimeBefore = statSync(configPath).mtimeMs;

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    expect(result.fileModified).toBe(false);
    expect(statSync(configPath).mtimeMs).toBe(mtimeBefore);
  });

  it("signale les routes obsolètes sans les supprimer ni réécrire le fichier", async () => {
    const goneRoute = { id: "gone", path: "/gone", enableSnapshot: false };
    writeConfig({ project: {}, routes: [goneRoute] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([]),
    });

    expect(result.obsolete).toEqual([goneRoute]);
    expect(result.fileModified).toBe(false);

    const written = JSON.parse(readFileSync(result.configFilePath, "utf-8")) as {
      routes: unknown[];
    };
    expect(written.routes).toEqual([goneRoute]);
  });

  it("ne modifie que la clé 'routes', préservant le reste de la configuration", async () => {
    writeConfig({
      project: { root: ".", baseUrl: "http://localhost:3000" },
      output: { directory: "./captures", fullPage: false },
      routes: [],
    });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    const written = JSON.parse(readFileSync(result.configFilePath, "utf-8")) as {
      project: unknown;
      output: unknown;
    };
    expect(written.project).toEqual({ root: ".", baseUrl: "http://localhost:3000" });
    expect(written.output).toEqual({ directory: "./captures", fullPage: false });
  });

  it("n'écrit aucun fichier temporaire résiduel après une écriture", async () => {
    writeConfig({ project: {}, routes: [] });

    await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    expect(readdirSync(dir)).toEqual(["snaprun.config.json"]);
  });

  it("la fusion reste idempotente à travers deux exécutions réelles successives", async () => {
    writeConfig({ project: {}, routes: [] });
    const scanner = fakeScanner([discoveredRoute("/blog")]);

    const first = await runScan({ cwd: dir, defaultEnableSnapshot: false, scanner });
    const second = await runScan({ cwd: dir, defaultEnableSnapshot: false, scanner });

    expect(first.added).toHaveLength(1);
    expect(second.added).toEqual([]);
    expect(second.unchanged).toEqual(first.added);
    expect(second.fileModified).toBe(false);
  });

  it("une nouvelle route statique respecte --default=enabled", async () => {
    writeConfig({ project: {}, routes: [] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: true,
      scanner: fakeScanner([discoveredRoute("/blog")]),
    });

    expect(result.added[0]?.enableSnapshot).toBe(true);
  });

  it("une nouvelle route dynamique reste désactivée même avec --default=enabled", async () => {
    writeConfig({ project: {}, routes: [] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: true,
      scanner: fakeScanner([discoveredRoute("/stays/[stayId]", true)]),
    });

    expect(result.added[0]?.enableSnapshot).toBe(false);
    expect(result.added[0]).toMatchObject({ parameters: { stayId: "REPLACE_ME" } });
  });

  it("préserve une route dynamique existante déjà configurée et activée", async () => {
    const existingDynamicRoute = {
      id: "stays-stayId",
      path: "/stays/[stayId]",
      isDynamic: true,
      parameters: { stayId: "seed-stay-123" },
      enableSnapshot: true,
    };
    writeConfig({ project: {}, routes: [existingDynamicRoute] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: false,
      scanner: fakeScanner([discoveredRoute("/stays/[stayId]", true)]),
    });

    expect(result.unchanged).toEqual([existingDynamicRoute]);
    expect(result.fileModified).toBe(false);
  });

  it("n'écrit jamais une route catch-all avec parameters: {}", async () => {
    writeConfig({ project: {}, routes: [] });

    const result = await runScan({
      cwd: dir,
      defaultEnableSnapshot: true,
      scanner: fakeScanner([discoveredRoute("/docs/[...slug]", true)]),
    });

    expect(result.added).toEqual([]);
    expect(result.unsupportedCatchAll).toHaveLength(1);
    expect(result.fileModified).toBe(false);

    const written = JSON.parse(readFileSync(result.configFilePath, "utf-8")) as {
      routes: unknown[];
    };
    expect(written.routes).toEqual([]);
  });

  it("reste idempotent avec routes statiques, dynamiques et catch-all mélangées", async () => {
    writeConfig({ project: {}, routes: [] });
    const scanner = fakeScanner([
      discoveredRoute("/blog"),
      discoveredRoute("/stays/[stayId]", true),
      discoveredRoute("/docs/[...slug]", true),
    ]);

    const first = await runScan({ cwd: dir, defaultEnableSnapshot: true, scanner });
    const second = await runScan({ cwd: dir, defaultEnableSnapshot: true, scanner });

    expect(first.added).toHaveLength(2);
    expect(second.added).toEqual([]);
    expect(second.unchanged).toEqual(first.added);
    expect(second.unsupportedCatchAll).toHaveLength(1);
    expect(second.fileModified).toBe(false);
  });
});
