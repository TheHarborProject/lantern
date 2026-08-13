import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BaseUrlMissingError } from "../errors/base-url-missing-error.js";
import { ConfigNotFoundError } from "../errors/config-not-found-error.js";
import { RunNotFoundError } from "../errors/run-not-found-error.js";
import { computeSnapshotFilePath } from "./compute-snapshot-file-path.js";
import { startFakeSnapshotServer, type FakeSnapshotServer } from "../testing/fake-snapshot-server.js";
import { runSnapshots } from "./run-snapshots.js";

describe("runSnapshots", () => {
  let browser: Browser;
  let server: FakeSnapshotServer;
  let dir: string;

  beforeEach(async () => {
    // Un navigateur frais par test (pas partagé) : chaque test peut vérifier
    // sa propre garantie de fermeture (browser.isConnected()) sans
    // interférer avec les autres.
    browser = await chromium.launch();
    server = await startFakeSnapshotServer();
    dir = mkdtempSync(join(tmpdir(), "snaprun-run-snapshots-"));
  });

  afterEach(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
    // Filet de sécurité : browser.close() est idempotent (Playwright), donc
    // sans effet si runSnapshots l'a déjà fermé — utile si un test échoue
    // avant d'atteindre cette assertion.
    await browser.close();
  });

  function writeConfig(config: Record<string, unknown>): void {
    writeFileSync(join(dir, "snaprun.config.json"), JSON.stringify(config, null, 2));
  }

  function launchBrowser(): Promise<Browser> {
    return Promise.resolve(browser);
  }

  it("capture tous les runs et routes standalone avec la sélection 'all'", async () => {
    writeConfig({
      project: { baseUrl: server.baseUrl },
      output: { directory: "./out" },
      routes: [
        { id: "home", path: "/home", enableSnapshot: true },
        { id: "extra", path: "/calendar", enableSnapshot: true },
      ],
      runs: [{ runName: "member", order: 1, routes: ["home"] }],
    });

    const report = await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });

    expect(report.succeeded).toBe(true);
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]?.runName).toBe("member");
    expect(report.runs[0]?.snapshots[0]?.routeId).toBe("home");
    expect(report.standalone).toHaveLength(1);
    expect(report.standalone[0]?.routeId).toBe("extra");
    expect(existsSync(join(dir, "out", "member", "01-home.png"))).toBe(true);
    expect(existsSync(join(dir, "out", "standalone", "extra.png"))).toBe(true);
  });

  it("reuses a single run id for every screenshot when output.structure = 'run'", async () => {
    writeConfig({
      project: { baseUrl: server.baseUrl },
      output: { directory: "./out", structure: "run" },
      routes: [
        { id: "home", path: "/home", enableSnapshot: true },
        { id: "calendar", path: "/calendar", enableSnapshot: true },
      ],
      runs: [{ runName: "member", order: 1, routes: ["home", "calendar"] }],
    });

    await runSnapshots({
      cwd: dir,
      selection: { kind: "all" },
      launchBrowser,
      now: () => new Date("2026-08-06T18:56:00"),
    });

    expect(existsSync(join(dir, "out", "run", "2026-08-06_1856", "home", "page.png"))).toBe(true);
    expect(existsSync(join(dir, "out", "run", "2026-08-06_1856", "calendar", "page.png"))).toBe(
      true,
    );
  });

  it("stores screenshots under their scope when output.structure = 'scope'", async () => {
    writeConfig({
      project: { baseUrl: server.baseUrl },
      output: { directory: "./out", structure: "scope" },
      routes: [
        { id: "home", path: "/home", scope: "public", enableSnapshot: true },
        { id: "calendar", path: "/calendar", enableSnapshot: true },
      ],
      runs: [],
    });

    await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });

    expect(existsSync(join(dir, "out", "public", "home", "page.png"))).toBe(true);
    expect(existsSync(join(dir, "out", "unscoped", "calendar", "page.png"))).toBe(true);
  });

  it("résout output.directory relativement à project.root, pas au cwd du process ni au répertoire du fichier de configuration quand ils diffèrent", async () => {
    mkdirSync(join(dir, "app"), { recursive: true });
    writeConfig({
      project: { root: "./app", baseUrl: server.baseUrl },
      output: { directory: "./snapshots" },
      routes: [{ id: "home", path: "/home", enableSnapshot: true }],
      runs: [],
    });

    await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });

    // project.root ("./app") est différent du répertoire du fichier de
    // configuration (dir) : la sortie doit suivre project.root, pas dir.
    expect(existsSync(join(dir, "app", "snapshots", "standalone", "home.png"))).toBe(true);
    expect(existsSync(join(dir, "snapshots", "standalone", "home.png"))).toBe(false);
  });

  it("capture uniquement le run demandé avec la sélection 'run'", async () => {
    writeConfig({
      project: { baseUrl: server.baseUrl },
      output: { directory: "./out" },
      routes: [
        { id: "home", path: "/home", enableSnapshot: true },
        { id: "calendar", path: "/calendar", enableSnapshot: true },
      ],
      runs: [
        { runName: "member", order: 1, routes: ["home"] },
        { runName: "admin", order: 2, routes: ["calendar"] },
      ],
    });

    const report = await runSnapshots({
      cwd: dir,
      selection: { kind: "run", runName: "admin" },
      launchBrowser,
    });

    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]?.runName).toBe("admin");
    expect(report.standalone).toEqual([]);
  });

  it("capture une route ad hoc hors run avec la sélection 'route', même désactivée en configuration", async () => {
    writeConfig({
      project: { baseUrl: server.baseUrl },
      output: { directory: "./out" },
      routes: [{ id: "home", path: "/home", enableSnapshot: false }],
      runs: [],
    });

    const report = await runSnapshots({
      cwd: dir,
      selection: { kind: "route", routePath: "/home", user: undefined },
      launchBrowser,
    });

    expect(report.succeeded).toBe(true);
    expect(report.runs).toEqual([]);
    expect(report.standalone).toHaveLength(1);
    expect(report.standalone[0]?.routeId).toBe("home");
  });

  it("lève BASE_URL_MISSING si project.baseUrl est absent de la configuration", async () => {
    writeConfig({ project: {}, routes: [], runs: [] });

    await expect(
      runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser }),
    ).rejects.toBeInstanceOf(BaseUrlMissingError);
  });

  it("lève RUN_NOT_FOUND si --runName ne correspond à aucun run configuré", async () => {
    writeConfig({ project: { baseUrl: server.baseUrl }, routes: [], runs: [] });

    await expect(
      runSnapshots({ cwd: dir, selection: { kind: "run", runName: "absent" }, launchBrowser }),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("lève CONFIG_NOT_FOUND si aucun fichier de configuration n'existe", async () => {
    await expect(
      runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser }),
    ).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it("respecte --config (chemin de configuration explicite)", async () => {
    writeFileSync(
      join(dir, "custom.json"),
      JSON.stringify({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      }),
    );

    const report = await runSnapshots({
      cwd: dir,
      explicitConfigPath: "custom.json",
      selection: { kind: "all" },
      launchBrowser,
    });

    expect(report.succeeded).toBe(true);
    expect(existsSync(join(dir, "out", "standalone", "home.png"))).toBe(true);
  });

  describe("cycle de vie du Browser", () => {
    /**
     * `runSnapshots` est le seul propriétaire du `Browser` (RFC-010,
     * correction post-revue) : `launchBrowser` (ici la fabrique de test) est
     * appelée une fois, et le `Browser` obtenu est systématiquement fermé
     * dans un `finally`, quelle que soit l'issue — succès, capture en
     * échec, authentification en échec, ou exception inattendue.
     */

    it("ferme le navigateur après un succès complet (sélection 'all')", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      const report = await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });

      expect(report.succeeded).toBe(true);
      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur après un succès complet (sélection 'run')", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [{ runName: "member", order: 1, routes: ["home"] }],
      });

      await runSnapshots({
        cwd: dir,
        selection: { kind: "run", runName: "member" },
        launchBrowser,
      });

      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur après un succès complet (sélection 'route')", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      await runSnapshots({
        cwd: dir,
        selection: { kind: "route", routePath: "/home", user: undefined },
        launchBrowser,
      });

      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur après une capture en échec (rapport succeeded: false)", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [
          {
            id: "unreachable",
            path: "/home",
            enableSnapshot: true,
            snapshotPath: "http://127.0.0.1:1/x",
          },
        ],
        runs: [],
      });

      const report = await runSnapshots({
        cwd: dir,
        selection: { kind: "route", routePath: "/home", user: undefined },
        launchBrowser,
      });

      expect(report.succeeded).toBe(false);
      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur après un échec d'authentification", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        auth: {
          loginRoute: "/login",
          selectors: {
            email: "input[name='email']",
            password: "input[name='password']",
            submit: "button[type='submit']",
          },
          successUrl: "**/home",
          // "member" n'existe pas dans users : USER_NOT_FOUND, levée par
          // FormAuthAdapter avant toute navigation (échec rapide et
          // déterministe, sans attendre un timeout réseau).
          users: {},
        },
        routes: [{ id: "home", path: "/home", enableSnapshot: true, user: "member" }],
        runs: [],
      });

      const report = await runSnapshots({
        cwd: dir,
        selection: { kind: "route", routePath: "/home", user: undefined },
        launchBrowser,
      });

      expect(report.succeeded).toBe(false);
      expect(report.failure?.routeId).toBe("home");
      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur si une exception inattendue survient après son lancement (écriture PNG impossible)", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "blocked", path: "/home", enableSnapshot: true }],
        runs: [],
      });
      // Pré-crée un dossier là où le PNG doit être écrit : page.screenshot()
      // échoue après une navigation réussie.
      mkdirSync(
        computeSnapshotFilePath(join(dir, "out"), {
          kind: "standalone",
          routeId: "blocked",
        }),
        { recursive: true },
      );

      const report = await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });

      expect(report.succeeded).toBe(false);
      expect(browser.isConnected()).toBe(false);
    });

    it("ferme le navigateur si une erreur totalement inattendue survient après son lancement", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      // Simule une panne Playwright imprévisible (pas un échec de route) :
      // browser.newContext() lève avant même la création d'un contexte,
      // donc en dehors de tout try/catch de captureSnapshots (RFC-009).
      const newContextSpy = vi
        .spyOn(browser, "newContext")
        .mockRejectedValue(new Error("panne Playwright totalement inattendue"));

      await expect(
        runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser }),
      ).rejects.toThrow("panne Playwright totalement inattendue");

      newContextSpy.mockRestore();
      expect(browser.isConnected()).toBe(false);
    });

    it("ne lance jamais le navigateur si la sélection est invalide avant tout accès au navigateur", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      await expect(
        runSnapshots({ cwd: dir, selection: { kind: "run", runName: "absent" }, launchBrowser }),
      ).rejects.toThrow();

      // Le navigateur injecté (lancé au beforeEach) n'a jamais été touché :
      // resolveSnapshotScope échoue avant tout appel à launchBrowser().
      expect(browser.isConnected()).toBe(true);
    });

    it("ferme le vrai navigateur lancé par le chemin par défaut (sans fabrique injectée)", async () => {
      writeConfig({
        project: { baseUrl: server.baseUrl },
        output: { directory: "./out" },
        routes: [{ id: "home", path: "/home", enableSnapshot: true }],
        runs: [],
      });

      const originalLaunch = chromium.launch.bind(chromium);
      let launchedBrowser: Browser | undefined;
      const launchSpy = vi.spyOn(chromium, "launch").mockImplementation(async (launchOptions) => {
        launchedBrowser = await originalLaunch(launchOptions);
        return launchedBrowser;
      });

      try {
        const report = await runSnapshots({ cwd: dir, selection: { kind: "all" } });

        expect(report.succeeded).toBe(true);
        expect(launchedBrowser).toBeDefined();
        expect(launchedBrowser?.isConnected()).toBe(false);
      } finally {
        launchSpy.mockRestore();
      }
    });
  });
});
