import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthAdapter } from "../auth/auth-adapter.js";
import { FormAuthAdapter } from "../auth/form-auth-adapter.js";
import type { AuthConfig } from "../types/auth.js";
import type { RawDynamicRoute, RawRoute, RawStaticRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { captureSnapshots } from "./capture-snapshots.js";
import { computeSnapshotFilePath } from "./compute-snapshot-file-path.js";
import {
  startFakeSnapshotServer,
  VALID_EMAIL,
  VALID_PASSWORD,
  type FakeSnapshotServer,
} from "../testing/fake-snapshot-server.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function staticRoute(
  id: string,
  path: string,
  overrides: Partial<RawStaticRoute> = {},
): RawStaticRoute {
  return { id, path, enableSnapshot: true, ...overrides };
}

function run(overrides: Partial<RawRun> = {}): RawRun {
  return { runName: "run", order: 1, routes: [], ...overrides };
}

function expectRealPng(filePath: string): void {
  expect(existsSync(filePath)).toBe(true);
  expect(readFileSync(filePath).subarray(0, 8)).toEqual(PNG_SIGNATURE);
}

function authConfig(users: AuthConfig["users"]): AuthConfig {
  return {
    loginRoute: "/login",
    selectors: {
      email: 'input[name="email"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]',
    },
    successUrl: "**/home",
    users,
  };
}

describe("captureSnapshots", () => {
  let browser: Browser;
  let server: FakeSnapshotServer;
  let outputDirectory: string;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    server = await startFakeSnapshotServer();
    outputDirectory = mkdtempSync(join(tmpdir(), "snaprun-capture-snapshots-"));
  });

  afterEach(async () => {
    await server.close();
    rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("capture des PNG réels, dans l'ordre des runs/routes, avec routes dynamiques et standalone, en contextes isolés", async () => {
    const routes: RawRoute[] = [
      staticRoute("home", "/home"),
      staticRoute("calendar", "/calendar"),
      {
        id: "stay",
        path: "/stays/[stayId]",
        isDynamic: true,
        parameters: { stayId: "seed-1" },
        enableSnapshot: true,
      },
      staticRoute("extra-standalone", "/home"),
    ];
    const runs: RawRun[] = [
      run({ runName: "member", order: 1, routes: ["home", "stay"] }),
      run({ runName: "admin", order: 2, routes: ["calendar"] }),
    ];

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
    });

    expect(report.succeeded).toBe(true);
    expect(report.failure).toBeUndefined();

    // Ordre des noms : position dans le run, préfixe zéro-paddé.
    expect(report.runs).toHaveLength(2);
    expect(report.runs[0]?.runName).toBe("member");
    expect(report.runs[0]?.snapshots.map((s) => s.routeId)).toEqual(["home", "stay"]);
    expect(report.runs[0]?.snapshots[0]?.filePath).toBe(
      join(outputDirectory, "member", "01-home.png"),
    );
    expect(report.runs[0]?.snapshots[1]?.filePath).toBe(
      join(outputDirectory, "member", "02-stay.png"),
    );
    expect(report.runs[1]?.runName).toBe("admin");
    expect(report.runs[1]?.snapshots[0]?.filePath).toBe(
      join(outputDirectory, "admin", "01-calendar.png"),
    );

    // Standalone : sans préfixe numérique, sous 'standalone/'.
    expect(report.standalone).toHaveLength(1);
    expect(report.standalone[0]?.routeId).toBe("extra-standalone");
    expect(report.standalone[0]?.filePath).toBe(
      join(outputDirectory, "standalone", "extra-standalone.png"),
    );

    for (const snapshot of [...report.runs.flatMap((r) => r.snapshots), ...report.standalone]) {
      expectRealPng(snapshot.filePath);
      expect(snapshot.durationMs).toBeGreaterThanOrEqual(0);
    }

    // Contexte isolé : un seul id de session par run (réutilisé entre ses
    // routes), et un id différent par run / route standalone.
    const sessionIds = server.sessionIdsSeen();
    expect(sessionIds).toHaveLength(4); // home, stay (member), calendar (admin), extra-standalone
    const [homeSid, staySid, calendarSid, standaloneSid] = sessionIds;
    expect(staySid).toBe(homeSid);
    expect(calendarSid).not.toBe(homeSid);
    expect(standaloneSid).not.toBe(homeSid);
    expect(standaloneSid).not.toBe(calendarSid);
  });

  it("s'arrête fail-fast à la première capture en échec et rapporte les captures déjà réussies", async () => {
    const routes: RawRoute[] = [
      staticRoute("ok-route", "/home"),
      staticRoute("bad-route", "/home", { snapshotPath: "http://127.0.0.1:1/unreachable" }),
      staticRoute("never-reached", "/home"),
    ];
    const runs: RawRun[] = [
      run({ runName: "first", order: 1, routes: ["ok-route", "bad-route"] }),
      run({ runName: "second", order: 2, routes: ["never-reached"] }),
    ];

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
      timeoutMs: 5000,
    });

    expect(report.succeeded).toBe(false);
    expect(report.failure?.routeId).toBe("bad-route");
    expect(report.failure?.runName).toBe("first");
    expect(report.failure?.message.length).toBeGreaterThan(0);

    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]?.runName).toBe("first");
    expect(report.runs[0]?.snapshots.map((s) => s.routeId)).toEqual(["ok-route"]);
    expect(report.standalone).toEqual([]);
  });

  it("conserve dans le rapport toutes les captures déjà réussies avant l'arrêt fail-fast (A✅ B✅ C❌)", async () => {
    const routes: RawRoute[] = [
      staticRoute("route-a", "/home"),
      staticRoute("route-b", "/calendar"),
      staticRoute("route-c", "/home", { snapshotPath: "http://127.0.0.1:1/unreachable" }),
    ];
    const runs: RawRun[] = [
      run({ runName: "solo", order: 1, routes: ["route-a", "route-b", "route-c"] }),
    ];

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
      timeoutMs: 5000,
    });

    expect(report.succeeded).toBe(false);
    // Les deux premières captures réussies (A, B) ne sont jamais perdues.
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]?.snapshots.map((s) => s.routeId)).toEqual(["route-a", "route-b"]);
    for (const snapshot of report.runs[0]?.snapshots ?? []) {
      expectRealPng(snapshot.filePath);
    }
    // La troisième (C) est bien rapportée comme l'échec, pas silencieusement ignorée.
    expect(report.failure?.routeId).toBe("route-c");
  });

  describe("cycle de vie des ressources Playwright", () => {
    /**
     * Vérifie qu'un scénario d'échec donné ne laisse fuir ni `BrowserContext`
     * ni `Browser` : le nombre de contextes ouverts sur `browser` doit
     * revenir à son niveau d'avant l'appel, et le navigateur (propriété de
     * ce fichier de test, jamais de `captureSnapshots`) doit rester connecté.
     */
    async function expectNoResourceLeak(routes: RawRoute[], auth?: AuthAdapter): Promise<void> {
      const runs: RawRun[] = [run({ runName: "solo", order: 1, routes: routes.map((r) => r.id) })];
      const contextsBefore = browser.contexts().length;

      const report = await captureSnapshots({
        browser,
        baseUrl: server.baseUrl,
        outputDirectory,
        fullPage: true,
        routes,
        runs,
        timeoutMs: 5000,
        ...(auth !== undefined ? { auth } : {}),
      });

      expect(report.succeeded).toBe(false);
      expect(browser.contexts().length).toBe(contextsBefore);
      expect(browser.isConnected()).toBe(true);
    }

    it("erreur de navigation : ne laisse fuir ni contexte ni navigateur", async () => {
      await expectNoResourceLeak([
        staticRoute("nav-fail", "/home", { snapshotPath: "http://127.0.0.1:1/unreachable" }),
      ]);
    });

    it("erreur d'écriture du PNG (capture) : ne laisse fuir ni contexte ni navigateur", async () => {
      const filePath = computeSnapshotFilePath(outputDirectory, {
        kind: "run",
        runName: "solo",
        index: 1,
        routeId: "screenshot-fail",
      });
      // Un dossier existe déjà là où le fichier PNG doit être écrit :
      // page.screenshot() échoue à l'écriture, après une navigation réussie.
      mkdirSync(filePath, { recursive: true });

      await expectNoResourceLeak([staticRoute("screenshot-fail", "/home")]);
    });

    it("erreur d'authentification : ne laisse fuir ni contexte ni navigateur", async () => {
      const failingAuth: AuthAdapter = {
        login: () => Promise.reject(new Error("boom : échec d'authentification simulé")),
      };

      await expectNoResourceLeak(
        [staticRoute("auth-fail", "/home", { user: "member" })],
        failingAuth,
      );
    });

    it("exception inattendue dans captureRoute (route dynamique invalide) : ne laisse fuir ni contexte ni navigateur", async () => {
      // Contourne volontairement la validation Zod pour simuler une route
      // dynamique incohérente atteignant directement captureRoute : celui-ci
      // délègue la résolution d'URL à resolveRoutePath (RFC-004), qui lève de
      // façon synchrone avant toute navigation.
      const invalidDynamicRoute: RawDynamicRoute = {
        id: "unexpected-fail",
        path: "/stays/[stayId]",
        isDynamic: true,
        parameters: {},
        enableSnapshot: true,
      };

      await expectNoResourceLeak([invalidDynamicRoute]);
    });
  });

  describe("authentification (RFC-007)", () => {
    it("appelle AuthAdapter.login() au plus une fois par contexte pour deux routes du même run nécessitant le même utilisateur", async () => {
      const auth = new FormAuthAdapter({
        auth: authConfig({ member: { email: VALID_EMAIL, password: VALID_PASSWORD } }),
        baseUrl: server.baseUrl,
        workingDirectory: process.cwd(),
        timeoutMs: 5000,
      });
      const routes: RawRoute[] = [
        staticRoute("home", "/home", { user: "member" }),
        staticRoute("calendar", "/calendar", { user: "member" }),
      ];
      const runs: RawRun[] = [run({ runName: "member", order: 1, routes: ["home", "calendar"] })];

      const report = await captureSnapshots({
        browser,
        baseUrl: server.baseUrl,
        outputDirectory,
        fullPage: true,
        routes,
        runs,
        auth,
      });

      expect(report.succeeded).toBe(true);
      expect(server.loginAttemptCount()).toBe(1);
    });

    it("ne tente aucune authentification pour une route publique (sans user)", async () => {
      const auth = new FormAuthAdapter({
        auth: authConfig({ member: { email: VALID_EMAIL, password: VALID_PASSWORD } }),
        baseUrl: server.baseUrl,
        workingDirectory: process.cwd(),
        timeoutMs: 5000,
      });
      const routes: RawRoute[] = [staticRoute("home", "/home")];
      const runs: RawRun[] = [run({ runName: "public", order: 1, routes: ["home"] })];

      const report = await captureSnapshots({
        browser,
        baseUrl: server.baseUrl,
        outputDirectory,
        fullPage: true,
        routes,
        runs,
        auth,
      });

      expect(report.succeeded).toBe(true);
      expect(server.loginAttemptCount()).toBe(0);
    });

    it("authentifie indépendamment deux runs différents (deux contextes) nécessitant le même utilisateur", async () => {
      const auth = new FormAuthAdapter({
        auth: authConfig({ member: { email: VALID_EMAIL, password: VALID_PASSWORD } }),
        baseUrl: server.baseUrl,
        workingDirectory: process.cwd(),
        timeoutMs: 5000,
      });
      const routes: RawRoute[] = [
        staticRoute("home", "/home", { user: "member" }),
        staticRoute("calendar", "/calendar", { user: "member" }),
      ];
      const runs: RawRun[] = [
        run({ runName: "first", order: 1, routes: ["home"] }),
        run({ runName: "second", order: 2, routes: ["calendar"] }),
      ];

      const report = await captureSnapshots({
        browser,
        baseUrl: server.baseUrl,
        outputDirectory,
        fullPage: true,
        routes,
        runs,
        auth,
      });

      expect(report.succeeded).toBe(true);
      expect(server.loginAttemptCount()).toBe(2);
    });
  });
});
