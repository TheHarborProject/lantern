import type { RunningApplication } from "./spawn-application.js";

const GRACE_PERIOD_MS = 3_000;
const POLL_INTERVAL_MS = 20;

/**
 * Stop an application launched by SnapRun (RFC-011), never an external
 * server. This function is only called on a `RunningApplication` actually
 * created by {@link spawnApplication}. Send `SIGTERM` first for graceful
 * shutdown, then `SIGKILL` after a short grace period if the process is
 * still running. On POSIX, target the process group (`-pid`) to avoid
 * orphaned processes created by shell commands.
 *
 * On POSIX, waiting covers the whole group (`kill(-pid, 0)`), not only the
 * directly tracked process. An indirect child in the same group may receive
 * and process the signal a few milliseconds after the main process, and
 * waiting only for that main process would leave a window where the child is
 * still shutting down.
 */
export async function stopApplication(app: RunningApplication): Promise<void> {
  if (app.hasExited() || app.pid === undefined) {
    return;
  }

  const pid = app.pid;

  sendSignal(pid, "SIGTERM");
  await waitUntilStopped(app, pid, GRACE_PERIOD_MS);

  if (isRunning(app, pid)) {
    sendSignal(pid, "SIGKILL");
    await waitUntilStopped(app, pid, GRACE_PERIOD_MS);
  }
}

function isRunning(app: RunningApplication, pid: number): boolean {
  if (process.platform === "win32") {
    return !app.hasExited();
  }

  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitUntilStopped(app: RunningApplication, pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolvePromise) => {
    const check = (): void => {
      if (!isRunning(app, pid) || Date.now() >= deadline) {
        resolvePromise();
        return;
      }

      setTimeout(check, POLL_INTERVAL_MS);
    };

    check();
  });
}

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  try {
    if (process.platform === "win32") {
      process.kill(pid, signal);
    } else {
      // Process group (`detached: true` at creation time, RFC-011).
      process.kill(-pid, signal);
    }
  } catch {
    // Already stopped in the meantime: nothing to do.
  }
}
