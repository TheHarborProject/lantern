import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FormAuthAdapter } from "../auth/form-auth-adapter.js";
import type { AuthConfig } from "../types/auth.js";
import type { RawRoute, RawStaticRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { captureSnapshots } from "./capture-snapshots.js";
import {
  startFakeSnapshotServer,
  VALID_EMAIL,
  VALID_PASSWORD,
  type FakeSnapshotServer,
} from "../testing/fake-snapshot-server.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function staticRoute(id: string, path: string, overrides: Partial<RawStaticRoute> = {}): RawStaticRoute {
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

/**
 * Focused integration test for bounded parallel execution (RFC-014 §21): a
 * real Chromium, real captures, verifying that concurrent jobs keep correct
 * output paths, deterministic result association, isolated authentication, and
 * deterministic resource cleanup. Bounded-concurrency limits themselves are
 * proven deterministically by the scheduler unit tests.
 */
describe("captureSnapshots — exécution parallèle bornée (RFC-014)", () => {
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
    outputDirectory = mkdtempSync(join(tmpdir(), "snaprun-capture-concurrency-"));
  });

  afterEach(async () => {
    await server.close();
    rmSync(outputDirectory, { recursive: true, force: true });
  });

  it("capture plusieurs runs et une route standalone en parallèle : chemins corrects, contextes fermés", async () => {
    const routes: RawRoute[] = [
      staticRoute("home", "/home"),
      staticRoute("calendar", "/calendar"),
      staticRoute("solo", "/home"),
    ];
    const runs: RawRun[] = [
      run({ runName: "member", order: 1, routes: ["home"] }),
      run({ runName: "admin", order: 2, routes: ["calendar"] }),
    ];
    const contextsBefore = browser.contexts().length;

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
      concurrency: 3,
    });

    expect(report.succeeded).toBe(true);

    // Association déterministe malgré la complétion parallèle : ordre par index
    // de job (runs triés par 'order', puis standalone).
    expect(report.runs.map((r) => r.runName)).toEqual(["member", "admin"]);
    expect(report.runs[0]?.snapshots[0]?.filePath).toBe(
      join(outputDirectory, "member", "01-home.png"),
    );
    expect(report.runs[1]?.snapshots[0]?.filePath).toBe(
      join(outputDirectory, "admin", "01-calendar.png"),
    );
    expect(report.standalone.map((s) => s.routeId)).toEqual(["solo"]);
    expect(report.standalone[0]?.filePath).toBe(
      join(outputDirectory, "standalone", "solo.png"),
    );

    for (const snapshot of [...report.runs.flatMap((r) => r.snapshots), ...report.standalone]) {
      expectRealPng(snapshot.filePath);
    }

    // Nettoyage déterministe : chaque job a fermé son contexte.
    expect(browser.contexts().length).toBe(contextsBefore);
  });

  it("isole l'authentification entre deux runs exécutés en parallèle (concurrency = 2)", async () => {
    const auth = new FormAuthAdapter({
      auth: authConfig({
        member: { email: VALID_EMAIL, password: VALID_PASSWORD },
        admin: { email: VALID_EMAIL, password: VALID_PASSWORD },
      }),
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });
    const routes: RawRoute[] = [
      staticRoute("member-home", "/home", { user: "member" }),
      staticRoute("admin-calendar", "/calendar", { user: "admin" }),
    ];
    const runs: RawRun[] = [
      run({ runName: "member", order: 1, routes: ["member-home"] }),
      run({ runName: "admin", order: 2, routes: ["admin-calendar"] }),
    ];
    const contextsBefore = browser.contexts().length;

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
      auth,
      concurrency: 2,
    });

    expect(report.succeeded).toBe(true);
    // Chaque run s'authentifie dans son propre contexte : deux logins réels,
    // aucun partage d'état entre les deux exécutions concurrentes.
    expect(server.loginAttemptCount()).toBe(2);
    // Exactement deux sessions distinctes (une par run/contexte) : chaque
    // contexte réutilise son propre 'sid', et aucune session n'est partagée
    // entre les deux exécutions concurrentes — preuve d'absence de fuite.
    const distinctSessions = new Set(server.sessionIdsSeen());
    expect(distinctSessions.size).toBe(2);
    expect(browser.contexts().length).toBe(contextsBefore);
  });

  it("comportement fail-fast préservé sous parallélisme : un échec est rapporté et associé à sa route", async () => {
    const routes: RawRoute[] = [
      staticRoute("ok", "/home"),
      staticRoute("bad", "/home", { snapshotPath: "http://127.0.0.1:1/unreachable" }),
    ];
    const runs: RawRun[] = [
      run({ runName: "good", order: 1, routes: ["ok"] }),
      run({ runName: "broken", order: 2, routes: ["bad"] }),
    ];
    const contextsBefore = browser.contexts().length;

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      fullPage: true,
      routes,
      runs,
      concurrency: 2,
      timeoutMs: 5000,
    });

    expect(report.succeeded).toBe(false);
    expect(report.failure?.routeId).toBe("bad");
    expect(report.failure?.runName).toBe("broken");
    // Le job en échec libère son contexte comme les autres.
    expect(browser.contexts().length).toBe(contextsBefore);
  });
});
