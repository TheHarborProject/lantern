import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationStartFailedError } from "../errors/application-start-failed-error.js";
import { ApplicationUnreachableError } from "../errors/application-unreachable-error.js";
import { ensureApplicationAvailable } from "./ensure-application-available.js";
import { isBaseUrlReachable } from "./is-base-url-reachable.js";
import * as stopApplicationModule from "./stop-application.js";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntilReachable(baseUrl: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isBaseUrlReachable(baseUrl, 200)) {
      return;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error("waitUntilReachable: délai dépassé");
}

function getFreePort(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const probe = createNetServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === "string") {
          reject(new Error("getFreePort: adresse invalide"));
          return;
        }
        resolvePromise(address.port);
      });
    });
  });
}

describe("ensureApplicationAvailable", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-ensure-app-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("réutilise un serveur déjà en place sans jamais lancer startCommand (serveur existant)", async () => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200);
      res.end("ok");
    });
    await new Promise<void>((resolvePromise) =>
      server.listen(0, "127.0.0.1", () => resolvePromise()),
    );
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("adresse invalide");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const markerFile = join(dir, "started.marker");

    const result = await ensureApplicationAvailable(
      {
        baseUrl,
        autoStart: true,
        startCommand: `node -e "require('fs').writeFileSync('${markerFile}', 'ran')"`,
        workingDirectory: dir,
      },
      () => Promise.resolve("action-result"),
    );

    expect(result).toBe("action-result");
    expect(existsSync(markerFile)).toBe(false);

    // Conservation du serveur externe : toujours joignable après l'appel.
    await expect(isBaseUrlReachable(baseUrl)).resolves.toBe(true);

    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  });

  it("lève APPLICATION_UNREACHABLE si le serveur ne répond pas et autoStart est désactivé", async () => {
    await expect(
      ensureApplicationAvailable(
        {
          baseUrl: "http://127.0.0.1:1",
          autoStart: false,
          startCommand: undefined,
          workingDirectory: dir,
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toBeInstanceOf(ApplicationUnreachableError);
  });

  it("lance startCommand, attend la disponibilité, exécute l'action, puis arrête le processus créé (autostart)", async () => {
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const startCommand = [
      'node -e "',
      "setTimeout(() => {",
      `  require('http').createServer((req, res) => { res.end('ok'); }).listen(${port});`,
      "}, 300);",
      'setInterval(() => {}, 1000);"',
    ].join(" ");

    const result = await ensureApplicationAvailable(
      { baseUrl, autoStart: true, startCommand, workingDirectory: dir, startupTimeoutMs: 5000 },
      () => Promise.resolve("captured"),
    );

    expect(result).toBe("captured");

    // Arrêt du processus créé : le serveur ne répond plus après l'appel.
    await expect(isBaseUrlReachable(baseUrl, 300)).resolves.toBe(false);
  });

  it("lève APPLICATION_START_FAILED si la commande échoue avant de devenir joignable", async () => {
    await expect(
      ensureApplicationAvailable(
        {
          baseUrl: "http://127.0.0.1:1",
          autoStart: true,
          startCommand: "node -e \"console.error('boom'); process.exit(1)\"",
          workingDirectory: dir,
          startupTimeoutMs: 5000,
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toBeInstanceOf(ApplicationStartFailedError);
  });

  it("lève APPLICATION_UNREACHABLE en cas de dépassement du délai, et arrête tout de même le processus", async () => {
    const pidFile = join(dir, "pid.txt");
    const startCommand = `node -e "require('fs').writeFileSync('${pidFile}', String(process.pid)); setInterval(() => {}, 1000);"`;

    await expect(
      ensureApplicationAvailable(
        {
          baseUrl: "http://127.0.0.1:1",
          autoStart: true,
          startCommand,
          workingDirectory: dir,
          startupTimeoutMs: 500,
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toBeInstanceOf(ApplicationUnreachableError);

    const pid = Number(readFileSync(pidFile, "utf-8"));
    expect(isProcessAlive(pid)).toBe(false);
  });

  it("lève APPLICATION_START_FAILED si autoStart est activé sans startCommand configurée", async () => {
    await expect(
      ensureApplicationAvailable(
        {
          baseUrl: "http://127.0.0.1:1",
          autoStart: true,
          startCommand: undefined,
          workingDirectory: dir,
        },
        () => Promise.resolve(undefined),
      ),
    ).rejects.toBeInstanceOf(ApplicationStartFailedError);
  });

  describe("propriété du processus", () => {
    it("ne touche jamais à un serveur externe : jamais arrêté, PID inchangé, stopApplication jamais appelée", async () => {
      const port = await getFreePort();
      const baseUrl = `http://127.0.0.1:${port}`;

      // Un vrai processus externe, créé en dehors de tout mécanisme SnapRun
      // (pas via spawnApplication) : rien ne doit jamais le distinguer d'un
      // serveur lancé manuellement par l'utilisateur avant `snaprun`.
      const externalServer = spawn(
        "node",
        [
          "-e",
          `require('http').createServer((req, res) => { res.end('ok'); }).listen(${port}); setInterval(() => {}, 1000);`,
        ],
        { stdio: "ignore" },
      );
      const externalPid = externalServer.pid;
      expect(externalPid).toBeDefined();
      if (externalPid === undefined) {
        return;
      }

      const stopSpy = vi.spyOn(stopApplicationModule, "stopApplication");
      const markerFile = join(dir, "started.marker");

      try {
        await waitUntilReachable(baseUrl);

        const result = await ensureApplicationAvailable(
          {
            baseUrl,
            autoStart: true,
            startCommand: `node -e "require('fs').writeFileSync('${markerFile}', 'ran')"`,
            workingDirectory: dir,
          },
          () => Promise.resolve("action-result"),
        );

        expect(result).toBe("action-result");
        // startCommand jamais lancé.
        expect(existsSync(markerFile)).toBe(false);
        // stopApplication n'est jamais invoquée pour un serveur déjà joignable.
        expect(stopSpy).not.toHaveBeenCalled();
        // Le PID reste le même (aucun redémarrage) et le processus est
        // toujours vivant : SnapRun ne l'a pas arrêté.
        expect(externalServer.pid).toBe(externalPid);
        expect(isProcessAlive(externalPid)).toBe(true);
      } finally {
        stopSpy.mockRestore();
        externalServer.kill("SIGKILL");
      }
    });

    it("arrête le processus créé même si l'action échoue immédiatement après le démarrage", async () => {
      const port = await getFreePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const startCommand = [
        'node -e "',
        "setTimeout(() => {",
        `  require('http').createServer((req, res) => { res.end('ok'); }).listen(${port});`,
        "}, 300);",
        'setInterval(() => {}, 1000);"',
      ].join(" ");
      const actionError = new Error("captureSnapshots a échoué immédiatement");

      await expect(
        ensureApplicationAvailable(
          { baseUrl, autoStart: true, startCommand, workingDirectory: dir, startupTimeoutMs: 5000 },
          () => Promise.reject(actionError),
        ),
      ).rejects.toBe(actionError);

      // Le finally de nettoyage couvre aussi l'échec de l'action : le
      // processus créé (devenu joignable) est arrêté malgré tout.
      await expect(isBaseUrlReachable(baseUrl, 300)).resolves.toBe(false);
    });

    it("en cas de timeout, arrête le processus créé (et ses enfants) avant que l'erreur ne soit propagée : aucun orphelin", async () => {
      const pidFile = join(dir, "pids.json");
      const script = [
        "const { spawn } = require('child_process');",
        "const grandchild = spawn('node', ['-e', 'setInterval(() => {}, 1000)']);",
        `require('fs').writeFileSync('${pidFile}', JSON.stringify({ self: process.pid, grandchild: grandchild.pid }));`,
        "setInterval(() => {}, 1000);",
      ].join(" ");
      const startCommand = `node -e "${script}"`;

      let caught: unknown;
      try {
        await ensureApplicationAvailable(
          {
            baseUrl: "http://127.0.0.1:1",
            autoStart: true,
            startCommand,
            workingDirectory: dir,
            startupTimeoutMs: 500,
          },
          () => Promise.resolve(undefined),
        );
      } catch (error) {
        caught = error;
      }

      // Au moment où l'appelant reçoit l'erreur, le processus créé et son
      // propre enfant (imitant un gestionnaire de paquets qui démarre le
      // vrai serveur) sont déjà arrêtés — le try/finally attend
      // stopApplication() avant que la promesse ne se règle.
      expect(caught).toBeInstanceOf(ApplicationUnreachableError);
      const pids = JSON.parse(readFileSync(pidFile, "utf-8")) as {
        readonly self: number;
        readonly grandchild: number;
      };
      expect(isProcessAlive(pids.self)).toBe(false);
      expect(isProcessAlive(pids.grandchild)).toBe(false);
    });
  });
});
