import { resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { FormAuthAdapter } from "../auth/form-auth-adapter.js";
import { loadConfig } from "../config/load-config.js";
import { BaseUrlMissingError } from "../errors/base-url-missing-error.js";
import { ConfigOutputCollisionError } from "../errors/config-output-collision-error.js";
import { detectCollisions } from "../runner/collision/detect-collisions.js";
import { formatCollisions } from "../runner/collision/format-collisions.js";
import { planRunCaptures } from "../runner/collision/plan-run-captures.js";
import { promptCollisionResolution } from "../runner/collision/prompt-collision-resolution.js";
import type { CollisionPrompt } from "../runner/collision/types.js";
import { buildExecutionPlan } from "../runs/build-execution-plan.js";
import { ensureApplicationAvailable } from "../servers/ensure-application-available.js";
import type { ResolvedConfig } from "../types/config.js";
import type { SnapshotReport } from "../types/snapshot.js";
import type { SnapshotSelection } from "../types/snapshot-selection.js";
import { captureSnapshots } from "./capture-snapshots.js";
import { createRunId } from "./create-run-id.js";
import { resolveSnapshotScope } from "./resolve-snapshot-scope.js";

export interface RunSnapshotsOptions {
  readonly cwd: string;
  readonly explicitConfigPath?: string | undefined;
  readonly selection: SnapshotSelection;
  readonly onWarning?: ((message: string) => void) | undefined;
  /**
   * Browser factory, injectable for tests (to prove browser shutdown without
   * launching a real Chromium for every fast scenario). Defaults to
   * `() => chromium.launch()` (RFC-010).
   */
  readonly launchBrowser?: (() => Promise<Browser>) | undefined;
  readonly now?: (() => Date) | undefined;
  /**
   * Whether the session can prompt interactively (RFC-014.5). Defaults to
   * detecting a TTY on both stdin and stdout. When false, the `prompt`
   * collision strategy falls back to `error` so CI never blocks on stdin.
   */
  readonly isInteractive?: boolean | undefined;
  /** Interactive collision prompt, injectable for tests. */
  readonly promptCollision?: CollisionPrompt | undefined;
}

/**
 * Resolve `output.directory` (a relative configuration path) to an absolute
 * path (RFC-010). This rule is intentionally distinct from
 * `resolveConfigPaths` (RFC-002/003, left unchanged): it resolves relative to
 * `project.root`, which means transitively relative to the configuration file
 * directory only when `project.root` is `.` (the default). If
 * `project.root` points elsewhere (for example `"./app"`), output follows
 * `project.root`, not the configuration file directory or the process `cwd`.
 */
function resolveOutputDirectory(config: ResolvedConfig): string {
  return resolve(config.project.root, config.output.directory);
}

/**
 * Execute `snaprun` (RFC-010): load configuration, reduce `routes`/`runs` to
 * the requested scope (RFC-010), then delegate to `captureSnapshots`
 * (RFC-009).
 *
 * Sole owner of the `Browser`: this function is the only place in the
 * program that calls `chromium.launch()` (by default) or the injected
 * factory, and the only place that calls `browser.close()`. Closure is
 * unconditional across the full browser lifecycle through `try`/`finally`:
 * it runs after success, after a failed capture (`succeeded: false`), after
 * an authentication failure, and after any unexpected exception once the
 * browser has been launched. That is true for every selection
 * (`all`, `--runName`, `--route`) because all of them pass through the same
 * `captureSnapshots` call. The browser is never shared beyond this call.
 *
 * Snapshot jobs run through a bounded-concurrency scheduler (RFC-014): the
 * resolved `execution.concurrency` (default 4) caps how many run/standalone
 * jobs execute simultaneously. Ordering-sensitive steps — configuration
 * loading, application startup, browser launch, and the single
 * `browser.close()` — stay outside that concurrency and run once, before or
 * after the parallel section.
 *
 * Before any capture, ensure the application is reachable (RFC-011,
 * `ensureApplicationAvailable`): reuse `baseUrl` when it already responds,
 * otherwise launch `startCommand` if `autoStart` is enabled, wait for
 * readiness, then stop it after capture. An already running external server
 * is never stopped.
 *
 * Output collisions — two captures resolving to the same file — are handled
 * per `execution.collisionStrategy` (RFC-014.5): `error` (and non-interactive
 * `prompt`) abort before any application/browser work; `serialize` gates
 * conflicting captures; interactive `prompt` asks the user. Interactivity
 * defaults to whether both stdio streams are TTYs.
 *
 * @throws {ConfigNotFoundError} No configuration file was found.
 * @throws {ConfigInvalidError} Configuration is invalid.
 * @throws {ConfigOutputCollisionError} Output collision detected under the `error` strategy (or non-interactive `prompt`).
 * @throws {BaseUrlMissingError} `project.baseUrl` is missing from configuration.
 * @throws {RunNotFoundError} `--runName` does not match any run.
 * @throws {RouteNotFoundError} `--route` does not match any route, or not one from the selected run.
 * @throws {ApplicationUnreachableError} `baseUrl` is unreachable and `autoStart` is disabled, or startup timed out.
 * @throws {ApplicationStartFailedError} `autoStart` is enabled without `startCommand`, or the command exits before becoming reachable.
 */
export async function runSnapshots(options: RunSnapshotsOptions): Promise<SnapshotReport> {
  const config = loadConfig({
    cwd: options.cwd,
    explicitPath: options.explicitConfigPath,
    onWarning: options.onWarning,
  });

  if (config.project.baseUrl === undefined) {
    throw new BaseUrlMissingError();
  }

  const { routes, runs } = resolveSnapshotScope(config.routes, config.runs, options.selection);
  const outputDirectory = resolveOutputDirectory(config);
  const runId =
    config.output.structure === "run"
      ? createRunId((options.now ?? ((): Date => new Date()))())
      : undefined;

  const collisionStrategy = config.execution.collisionStrategy;
  const interactive =
    options.isInteractive ?? (process.stdout.isTTY === true && process.stdin.isTTY === true);
  const promptCollision = options.promptCollision ?? promptCollisionResolution;

  // Detect output collisions before starting the application or the browser
  // (RFC-014.5 §5): `error` — and non-interactive `prompt` — abort here, so CI
  // never spawns a dev server or Chromium just to fail on a known collision.
  if (collisionStrategy === "error" || (collisionStrategy === "prompt" && !interactive)) {
    const groups = detectCollisions(
      planRunCaptures(buildExecutionPlan(runs, routes), {
        outputDirectory,
        structure: config.output.structure,
        runId,
      }),
    );

    if (groups.length > 0) {
      throw new ConfigOutputCollisionError(formatCollisions(groups));
    }
  }

  const auth =
    config.auth !== undefined
      ? new FormAuthAdapter({
          auth: config.auth,
          baseUrl: config.project.baseUrl,
          workingDirectory: config.project.workingDirectory,
        })
      : undefined;

  const baseUrl = config.project.baseUrl;

  return ensureApplicationAvailable(
    {
      baseUrl,
      autoStart: config.project.autoStart,
      startCommand: config.project.startCommand,
      workingDirectory: config.project.workingDirectory,
    },
    async () => {
      const launchBrowser = options.launchBrowser ?? ((): Promise<Browser> => chromium.launch());
      const browser = await launchBrowser();

      try {
        return await captureSnapshots({
          browser,
          baseUrl,
          outputDirectory,
          outputStructure: config.output.structure,
          ...(runId !== undefined ? { runId } : {}),
          fullPage: config.output.fullPage,
          routes,
          runs,
          ...(auth !== undefined ? { auth } : {}),
          concurrency: config.execution.concurrency,
          collision: { strategy: collisionStrategy, interactive, prompt: promptCollision },
        });
      } finally {
        await browser.close();
      }
    },
  );
}
