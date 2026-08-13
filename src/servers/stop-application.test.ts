import { describe, expect, it } from "vitest";
import { spawnApplication } from "./spawn-application.js";
import { stopApplication } from "./stop-application.js";

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const check = (): void => {
      if (predicate()) {
        resolvePromise();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error("waitFor: délai dépassé"));
        return;
      }
      setTimeout(check, 20);
    };
    check();
  });
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("stopApplication", () => {
  it("arrête un processus en cours d'exécution (le processus créé par SnapRun)", async () => {
    const app = spawnApplication('node -e "setInterval(() => {}, 1000)"', process.cwd());
    const pid = app.pid;
    expect(pid).toBeDefined();
    if (pid === undefined) {
      return;
    }

    expect(isProcessAlive(pid)).toBe(true);

    await stopApplication(app);

    expect(app.hasExited()).toBe(true);
    expect(isProcessAlive(pid)).toBe(false);
  });

  it("ne fait rien (pas d'erreur) si le processus a déjà quitté de lui-même", async () => {
    const app = spawnApplication('node -e "process.exit(0)"', process.cwd());
    await waitFor(() => app.hasExited());

    await expect(stopApplication(app)).resolves.toBeUndefined();
  });

  it("n'oublie aucun processus enfant (groupe de processus) : la commande et ses propres enfants sont arrêtés", async () => {
    // Script shell dont la commande elle-même lance un enfant (imite un
    // gestionnaire de paquets qui démarre le vrai serveur) : les deux
    // doivent être arrêtés, sans laisser d'orphelin.
    const script = [
      "const { spawn } = require('child_process');",
      "const child = spawn('node', ['-e', 'setInterval(() => {}, 1000)']);",
      "console.log('GRANDCHILD_PID=' + child.pid);",
      "setInterval(() => {}, 1000);",
    ].join(" ");

    const app = spawnApplication(`node -e "${script}"`, process.cwd());

    await waitFor(() => app.capturedOutput().includes("GRANDCHILD_PID="));
    const match = /GRANDCHILD_PID=(\d+)/.exec(app.capturedOutput());
    const grandchildPid = match?.[1] !== undefined ? Number(match[1]) : undefined;
    expect(grandchildPid).toBeDefined();
    if (grandchildPid === undefined) {
      return;
    }

    expect(isProcessAlive(grandchildPid)).toBe(true);

    await stopApplication(app);

    expect(isProcessAlive(grandchildPid)).toBe(false);
  });
});
