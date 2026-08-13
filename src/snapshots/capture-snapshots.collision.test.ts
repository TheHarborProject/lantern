import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FormAuthAdapter } from "../auth/form-auth-adapter.js";
import { ConfigOutputCollisionError } from "../errors/config-output-collision-error.js";
import type { CollisionResolution } from "../runner/collision/types.js";
import type { AuthConfig } from "../types/auth.js";
import type { RawRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import { captureSnapshots, type CaptureSnapshotsOptions } from "./capture-snapshots.js";
import {
  startFakeSnapshotServer,
  VALID_EMAIL,
  VALID_PASSWORD,
  type FakeSnapshotServer,
} from "../testing/fake-snapshot-server.js";

/**
 * Collisions occur when the same route id is captured in several runs under an
 * output structure whose path omits the run (here `run`). `dashboard` is shared
 * by both runs (collision); `other` is unique (unrelated, stays parallel).
 */
function routes(): RawRoute[] {
  return [
    { id: "dashboard", path: "/home", enableSnapshot: true },
    { id: "other", path: "/calendar", enableSnapshot: true },
  ];
}

function runs(): RawRun[] {
  return [
    { runName: "member", order: 1, routes: ["dashboard"] },
    { runName: "admin", order: 2, routes: ["dashboard", "other"] },
  ];
}

const RUN_ID = "run1";

describe("captureSnapshots — collisions de sortie (RFC-014.5)", () => {
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
    outputDirectory = mkdtempSync(join(tmpdir(), "snaprun-collision-"));
  });

  afterEach(async () => {
    await server.close();
    rmSync(outputDirectory, { recursive: true, force: true });
  });

  function baseOptions(collision: CaptureSnapshotsOptions["collision"]): CaptureSnapshotsOptions {
    return {
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      outputStructure: "run",
      runId: RUN_ID,
      fullPage: true,
      routes: routes(),
      runs: runs(),
      concurrency: 2,
      timeoutMs: 5000,
      ...(collision !== undefined ? { collision } : {}),
    };
  }

  const dashboardPath = (): string => join(outputDirectory, "run", RUN_ID, "dashboard", "page.png");
  const otherPath = (): string => join(outputDirectory, "run", RUN_ID, "other", "page.png");

  it("error : abandonne avant toute capture et n'écrit aucun fichier", async () => {
    await expect(
      captureSnapshots(baseOptions({ strategy: "error", interactive: false })),
    ).rejects.toBeInstanceOf(ConfigOutputCollisionError);

    expect(existsSync(dashboardPath())).toBe(false);
    expect(existsSync(otherPath())).toBe(false);
  });

  it("prompt non interactif : se replie sur error (jamais de blocage stdin)", async () => {
    await expect(
      captureSnapshots(baseOptions({ strategy: "prompt", interactive: false })),
    ).rejects.toBeInstanceOf(ConfigOutputCollisionError);

    expect(existsSync(dashboardPath())).toBe(false);
  });

  it("serialize : capture les deux runs, rapporte la collision, garde les routes libres parallèles", async () => {
    const report = await captureSnapshots(baseOptions({ strategy: "serialize", interactive: false }));

    expect(report.succeeded).toBe(true);
    // La ressource en conflit est bien écrite (une seule fois sur disque) et la
    // route non conflictuelle aussi.
    expect(existsSync(dashboardPath())).toBe(true);
    expect(existsSync(otherPath())).toBe(true);

    // Les deux runs ont capturé leur dashboard (sérialisé, jamais concurrent).
    const member = report.runs.find((r) => r.runName === "member");
    const admin = report.runs.find((r) => r.runName === "admin");
    expect(member?.snapshots.map((s) => s.routeId)).toEqual(["dashboard"]);
    expect(admin?.snapshots.map((s) => s.routeId).sort()).toEqual(["dashboard", "other"]);

    // Rapport de collision déterministe, séparé des échecs.
    expect(report.failure).toBeUndefined();
    expect(report.collisions).toHaveLength(1);
    expect(report.collisions?.[0]?.filePath).toBe(dashboardPath());
    expect(report.collisions?.[0]?.captures).toEqual([
      { routeId: "dashboard", runName: "member" },
      { routeId: "dashboard", runName: "admin" },
    ]);
  });

  it("prompt + Skip : ignore les captures en conflit, capture les routes libres", async () => {
    const prompt = (): Promise<CollisionResolution> => Promise.resolve("skip");

    const report = await captureSnapshots(
      baseOptions({ strategy: "prompt", interactive: true, prompt }),
    );

    expect(report.succeeded).toBe(true);
    // La ressource en conflit n'est jamais écrite ; la route libre l'est.
    expect(existsSync(dashboardPath())).toBe(false);
    expect(existsSync(otherPath())).toBe(true);

    expect(report.skipped?.map((s) => s.runName)).toEqual(["member", "admin"]);
    expect(report.skipped?.every((s) => s.reason === "collision")).toBe(true);
    expect(report.collisions).toHaveLength(1);
  });

  it("prompt + Create subfolders : écrit chaque capture dans un sous-dossier unique déterministe", async () => {
    const prompt = (): Promise<CollisionResolution> => Promise.resolve("create-subfolders");

    const report = await captureSnapshots(
      baseOptions({ strategy: "prompt", interactive: true, prompt }),
    );

    expect(report.succeeded).toBe(true);
    // Le chemin en conflit d'origine n'est jamais écrit ; les sous-dossiers le sont.
    expect(existsSync(dashboardPath())).toBe(false);
    expect(existsSync(join(outputDirectory, "run", RUN_ID, "member", "dashboard", "page.png"))).toBe(
      true,
    );
    expect(existsSync(join(outputDirectory, "run", RUN_ID, "admin", "dashboard", "page.png"))).toBe(
      true,
    );
    expect(existsSync(otherPath())).toBe(true);

    const allSnapshots = report.runs.flatMap((r) => r.snapshots.map((s) => s.routeId));
    expect(allSnapshots.filter((id) => id === "dashboard")).toHaveLength(2);
  });

  it("prompt + Re-run sequentially : réécrit la ressource en conflit séquentiellement", async () => {
    const prompt = (): Promise<CollisionResolution> => Promise.resolve("rerun-sequentially");

    const report = await captureSnapshots(
      baseOptions({ strategy: "prompt", interactive: true, prompt }),
    );

    expect(report.succeeded).toBe(true);
    // Une seule ressource sur disque (le dernier dans l'ordre déterministe gagne).
    expect(existsSync(dashboardPath())).toBe(true);
    expect(existsSync(otherPath())).toBe(true);

    const allSnapshots = report.runs.flatMap((r) => r.snapshots.map((s) => s.routeId));
    expect(allSnapshots.filter((id) => id === "dashboard")).toHaveLength(2);
    expect(report.collisions).toHaveLength(1);
  });

  it("préserve la frontière de job RFC-014 : un run multi-routes reste un seul job (1 contexte, 1 login, ordre préservé) malgré une collision ailleurs", async () => {
    // 'member' est un run à deux routes authentifiées, sans collision. 'r1' et
    // 'r2' capturent la même route 'shared' (collision) : la planification de
    // collision est donc bien engagée, mais elle ne doit pas fragmenter 'member'
    // en jobs par route.
    const authConfig: AuthConfig = {
      loginRoute: "/login",
      selectors: {
        email: 'input[name="email"]',
        password: 'input[name="password"]',
        submit: 'button[type="submit"]',
      },
      successUrl: "**/home",
      users: { member: { email: VALID_EMAIL, password: VALID_PASSWORD } },
    };
    const auth = new FormAuthAdapter({
      auth: authConfig,
      baseUrl: server.baseUrl,
      workingDirectory: process.cwd(),
      timeoutMs: 5000,
    });

    const boundaryRoutes: RawRoute[] = [
      { id: "member-home", path: "/home", enableSnapshot: true, user: "member" },
      { id: "member-calendar", path: "/calendar", enableSnapshot: true, user: "member" },
      { id: "shared", path: "/home", enableSnapshot: true },
    ];
    const boundaryRuns: RawRun[] = [
      { runName: "member", order: 1, routes: ["member-home", "member-calendar"] },
      { runName: "r1", order: 2, routes: ["shared"] },
      { runName: "r2", order: 3, routes: ["shared"] },
    ];
    const contextsBefore = browser.contexts().length;

    const report = await captureSnapshots({
      browser,
      baseUrl: server.baseUrl,
      outputDirectory,
      outputStructure: "run",
      runId: RUN_ID,
      fullPage: true,
      routes: boundaryRoutes,
      runs: boundaryRuns,
      auth,
      concurrency: 3,
      timeoutMs: 5000,
      collision: { strategy: "serialize", interactive: false },
    });

    expect(report.succeeded).toBe(true);
    // La collision sur 'shared' a bien été planifiée (planification engagée).
    expect(report.collisions).toHaveLength(1);

    // 1) Le run 'member' reste un seul job : ses deux routes sont capturées
    //    dans l'ordre déclaré.
    const member = report.runs.find((r) => r.runName === "member");
    expect(member?.snapshots.map((s) => s.routeId)).toEqual(["member-home", "member-calendar"]);

    // 2) Authentification une seule fois pour tout le run (pas une par route).
    expect(server.loginAttemptCount()).toBe(1);

    // 3) Un contexte isolé par run (3 runs -> 3 sessions distinctes). Si 'member'
    //    avait été fragmenté en jobs par route, on observerait > 3 sessions.
    expect(new Set(server.sessionIdsSeen()).size).toBe(3);

    // 4) Aucune fuite de contexte : nettoyage déterministe.
    expect(browser.contexts().length).toBe(contextsBefore);
  });
});
