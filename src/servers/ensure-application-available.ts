import { ApplicationStartFailedError } from "../errors/application-start-failed-error.js";
import { ApplicationUnreachableError } from "../errors/application-unreachable-error.js";
import { isBaseUrlReachable } from "./is-base-url-reachable.js";
import { spawnApplication, type RunningApplication } from "./spawn-application.js";
import { stopApplication } from "./stop-application.js";

const DEFAULT_STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

export interface EnsureApplicationAvailableOptions {
  readonly baseUrl: string;
  readonly autoStart: boolean;
  readonly startCommand: string | undefined;
  readonly workingDirectory: string;
  /** Maximum wait time for availability after startup. Default: 30 s. */
  readonly startupTimeoutMs?: number;
}

/**
 * Ensure the application is reachable before executing `action` (RFC-011):
 * if `baseUrl` already responds, reuse that server as-is and never touch it.
 * Otherwise, when `autoStart` is enabled, launch `startCommand` from
 * `workingDirectory`, wait for readiness, execute `action`, then stop only
 * the process created by this call, always from a `finally` block. An
 * external server that was already running is never stopped:
 * `stopApplication` is called only for the process launched here.
 *
 * @throws {ApplicationUnreachableError} `baseUrl` does not respond and
 *   `autoStart` is disabled, or the readiness timeout expires after startup.
 * @throws {ApplicationStartFailedError} `autoStart` is enabled without
 *   `startCommand`, or the launched process exits before becoming reachable.
 */
export async function ensureApplicationAvailable<T>(
  options: EnsureApplicationAvailableOptions,
  action: () => Promise<T>,
): Promise<T> {
  if (await isBaseUrlReachable(options.baseUrl)) {
    return action();
  }

  if (!options.autoStart) {
    throw new ApplicationUnreachableError(options.baseUrl);
  }

  if (options.startCommand === undefined) {
    throw new ApplicationStartFailedError("(no startCommand configured)");
  }

  const app = spawnApplication(options.startCommand, options.workingDirectory);
  const uninstallSignalHandlers = installShutdownSignalHandlers(app);

  try {
    await waitUntilReady(app, options.startCommand, options.baseUrl, options.startupTimeoutMs);
    return await action();
  } finally {
    uninstallSignalHandlers();
    await stopApplication(app);
  }
}

async function waitUntilReady(
  app: RunningApplication,
  startCommand: string,
  baseUrl: string,
  startupTimeoutMs: number | undefined,
): Promise<void> {
  const deadline = Date.now() + (startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS);

  while (Date.now() < deadline) {
    if (app.hasExited()) {
      throw new ApplicationStartFailedError(startCommand, {
        cause: new Error(
          `Exit code ${String(app.exitCode())}${app.capturedOutput() !== "" ? `: ${app.capturedOutput()}` : ""}`,
        ),
      });
    }

    if (await isBaseUrlReachable(baseUrl)) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new ApplicationUnreachableError(baseUrl);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Best effort: if the SnapRun process receives SIGINT/SIGTERM while the
 * application is running, stop it before letting the signal continue through
 * its normal path (RFC-011: "handle signals"). `once()` ensures Node's
 * default behavior resumes on a second signal delivery.
 */
function installShutdownSignalHandlers(app: RunningApplication): () => void {
  const handleSignal = (signal: NodeJS.Signals): void => {
    void stopApplication(app).finally(() => {
      process.kill(process.pid, signal);
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  return () => {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };
}
