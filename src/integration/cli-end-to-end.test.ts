import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createProgram } from "../cli/program.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function expectRealPng(filePath: string): void {
  expect(existsSync(filePath)).toBe(true);
  expect(readFileSync(filePath).subarray(0, 8)).toEqual(PNG_SIGNATURE);
}

function writeFile(dir: string, relativePath: string, content: string): void {
  const fullPath = join(dir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content);
}

interface ScannedRoute {
  readonly id: string;
  readonly path: string;
  enableSnapshot: boolean;
  readonly isDynamic?: boolean;
  parameters?: Record<string, string>;
  user?: string;
}

/**
 * Test d'intégration bout en bout (RFC-012), entièrement local (aucun accès
 * réseau externe) : une fixture App Router réaliste, un `snaprun scan` réel
 * qui met à jour un fichier de configuration temporaire, une édition
 * manuelle de cette configuration (comme le ferait une personne après le
 * scan — activation, paramètre dynamique, run), puis un `snaprun` réel qui
 * capture l'application locale (servie par un serveur HTTP local, tenant
 * lieu d'application Next.js démarrée).
 *
 * La sortie console des commandes n'est pas interceptée ici : une fois un
 * vrai Chromium lancé (Playwright) dans ce même processus, `vi.spyOn`
 * n'intercepte plus fiablement `console.log` (constaté en investiguant un
 * faux positif de ce test), sans rapport avec le comportement réel de
 * SnapRun — vérifié en confirmant que la sortie s'affiche correctement sans
 * mock. Seuls les effets observables (fichier de configuration, code de
 * sortie, PNG produits) sont donc vérifiés.
 */
describe("CLI bout en bout : scan puis capture, sans Internet", () => {
  let browser: Browser;
  let server: Server;
  let baseUrl: string;
  let projectDir: string;
  const originalCwd = process.cwd();

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    projectDir = mkdtempSync(join(tmpdir(), "snaprun-e2e-"));

    // Fixture App Router (RFC-005) : une page publique, une page protégée,
    // une route dynamique.
    writeFile(projectDir, "app/page.tsx", "export default function Home() { return null; }");
    writeFile(
      projectDir,
      "app/calendar/page.tsx",
      "export default function Calendar() { return null; }",
    );
    writeFile(
      projectDir,
      "app/stays/[stayId]/page.tsx",
      "export default function Stay() { return null; }",
    );

    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<!doctype html><html><body><div data-testid="page">${url.pathname}</div></body></html>`,
      );
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, "127.0.0.1", () => resolvePromise()),
    );
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("scan réel puis capture réelle d'une application locale, à partir d'une configuration mise à jour manuellement", async () => {
    // 1. Configuration initiale minimale, avant tout scan.
    writeFileSync(join(projectDir, "snaprun.config.json"), JSON.stringify({ project: {} }));

    // 2. `snaprun scan` réel (RFC-006) : découvre les 3 routes de la fixture.
    const scanProgram = createProgram();
    scanProgram.exitOverride();
    await scanProgram.parseAsync(["scan", "--default=disabled"], { from: "user" });

    const scannedConfig = JSON.parse(
      readFileSync(join(projectDir, "snaprun.config.json"), "utf-8"),
    ) as { routes: ScannedRoute[] };
    expect(scannedConfig.routes.map((route) => route.path).sort()).toEqual(
      ["/", "/calendar", "/stays/[stayId]"].sort(),
    );
    // --default=disabled (RFC-006) : rien n'est activé par le scan.
    expect(scannedConfig.routes.every((route) => !route.enableSnapshot)).toBe(true);
    const dynamicRoute = scannedConfig.routes.find((route) => route.path === "/stays/[stayId]");
    expect(dynamicRoute?.parameters).toEqual({ stayId: "REPLACE_ME" });

    // 3. Édition manuelle post-scan (RFC-012 : « mise à jour config
    // temporaire ») : active les routes, renseigne le paramètre dynamique,
    // configure baseUrl/output/un run ordonné.
    const homeRoute = scannedConfig.routes.find((route) => route.path === "/");
    const calendarRoute = scannedConfig.routes.find((route) => route.path === "/calendar");
    if (homeRoute === undefined || calendarRoute === undefined || dynamicRoute === undefined) {
      throw new Error("routes attendues manquantes après le scan");
    }
    homeRoute.enableSnapshot = true;
    calendarRoute.enableSnapshot = true;
    dynamicRoute.enableSnapshot = true;
    dynamicRoute.parameters = { stayId: "seed-stay-123" };

    const finalConfig = {
      project: { baseUrl, autoStart: false },
      output: { directory: "./snapshots", fullPage: true },
      routes: scannedConfig.routes,
      runs: [
        {
          runName: "member",
          order: 1,
          routes: [calendarRoute.id, dynamicRoute.id],
        },
      ],
    };
    writeFileSync(join(projectDir, "snaprun.config.json"), JSON.stringify(finalConfig, null, 2));

    // 4. `snaprun` réel (RFC-009/010) : capture l'application locale (le
    // serveur HTTP local tient lieu d'application Next.js démarrée).
    const captureProgram = createProgram();
    captureProgram.exitOverride();
    process.exitCode = undefined;
    await captureProgram.parseAsync([], { from: "user" });

    expect(process.exitCode).toBe(0);

    // Run "member" : deux routes, dans l'ordre déclaré, numérotées.
    expectRealPng(join(projectDir, "snapshots", "member", "01-calendar.png"));
    expectRealPng(join(projectDir, "snapshots", "member", "02-stays-stayId.png"));
    // "/" est activée mais non référencée par un run : capture standalone.
    expectRealPng(join(projectDir, "snapshots", "standalone", "home.png"));
  }, 20000);
});
