import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigOutputCollisionError } from "../errors/config-output-collision-error.js";
import { runSnapshots } from "./run-snapshots.js";

/**
 * These tests exercise the CI-safe collision path (RFC-014.5 §5/§10): with the
 * `error` strategy — or a non-interactive `prompt` — a detected collision must
 * abort *before* the application is started or a browser is launched. The
 * injected `launchBrowser` therefore must never be called, so no real Chromium
 * or dev server is needed.
 */
describe("runSnapshots — collisions (abandon avant navigateur, RFC-014.5)", () => {
  let dir: string;
  let launched: boolean;

  const launchBrowser = (): Promise<Browser> => {
    launched = true;
    return Promise.reject(new Error("launchBrowser ne doit jamais être appelé"));
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-run-collision-"));
    launched = false;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeCollidingConfig(collisionStrategy: string): void {
    writeFileSync(
      join(dir, "snaprun.config.json"),
      JSON.stringify({
        // baseUrl présent : la vérification baseUrl passe, mais l'exécution
        // s'arrête sur la collision avant toute tentative réseau.
        project: { baseUrl: "http://127.0.0.1:9", autoStart: false },
        output: { directory: "./out", structure: "run" },
        execution: { concurrency: 4, collisionStrategy },
        routes: [
          { id: "dashboard", path: "/home", enableSnapshot: true },
          { id: "other", path: "/calendar", enableSnapshot: true },
        ],
        runs: [
          { runName: "member", order: 1, routes: ["dashboard"] },
          { runName: "admin", order: 2, routes: ["dashboard", "other"] },
        ],
      }),
    );
  }

  it("error : lève OUTPUT_COLLISION sans jamais lancer le navigateur", async () => {
    writeCollidingConfig("error");

    await expect(
      runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser }),
    ).rejects.toBeInstanceOf(ConfigOutputCollisionError);

    expect(launched).toBe(false);
  });

  it("prompt en environnement non interactif : se replie sur error, sans navigateur", async () => {
    writeCollidingConfig("prompt");

    await expect(
      runSnapshots({
        cwd: dir,
        selection: { kind: "all" },
        launchBrowser,
        isInteractive: false,
      }),
    ).rejects.toBeInstanceOf(ConfigOutputCollisionError);

    expect(launched).toBe(false);
  });

  it("le message d'erreur liste les jobs en conflit (rapport déterministe)", async () => {
    writeCollidingConfig("error");

    try {
      await runSnapshots({ cwd: dir, selection: { kind: "all" }, launchBrowser });
      expect.fail("runSnapshots aurait dû lever une erreur de collision");
    } catch (error) {
      const message = (error as ConfigOutputCollisionError).message;
      expect(message).toContain("collision");
      expect(message).toContain("member/dashboard");
      expect(message).toContain("admin/dashboard");
    }
  });
});
