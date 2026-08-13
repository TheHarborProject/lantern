import type { Browser, BrowserContext } from "playwright";
import type { AuthAdapter } from "../auth/auth-adapter.js";
import { ConfigOutputCollisionError } from "../errors/config-output-collision-error.js";
import { SnapshotFailedError } from "../errors/snapshot-failed-error.js";
import { detectCollisions } from "../runner/collision/detect-collisions.js";
import { formatCollisions } from "../runner/collision/format-collisions.js";
import { planRunCaptures } from "../runner/collision/plan-run-captures.js";
import { buildSerializeGates, type SerializeGate } from "../runner/collision/serialize-gates.js";
import { buildSubfolderPaths } from "../runner/collision/subfolder-paths.js";
import type {
  CollisionGroup,
  CollisionPrompt,
  CollisionStrategy,
  RunCapturePlan,
} from "../runner/collision/types.js";
import { runWithConcurrency } from "../runner/scheduler.js";
import { buildExecutionPlan } from "../runs/build-execution-plan.js";
import type { PlannedRoute } from "../types/execution-plan.js";
import type { RawRoute } from "../types/route.js";
import type { RawRun } from "../types/run.js";
import type {
  CapturedSnapshot,
  OutputCollision,
  RunSnapshotResult,
  SkippedCapture,
  SnapshotFailure,
  SnapshotReport,
} from "../types/snapshot.js";
import { captureRoute } from "./capture-route.js";
import { computeSnapshotFilePath } from "./compute-snapshot-file-path.js";
import { selectStandaloneRoutes } from "./select-standalone-routes.js";

/**
 * Output collision handling (RFC-014.5). Provided by `runSnapshots`; defaults
 * to `serialize` (safe, non-blocking) when omitted, so direct callers never
 * deadlock and never block on stdin.
 */
export interface CollisionHandling {
  readonly strategy: CollisionStrategy;
  readonly interactive: boolean;
  readonly prompt?: CollisionPrompt | undefined;
}

export interface CaptureSnapshotsOptions {
  /**
   * Provided by the caller and never created or closed here (RFC-009): this
   * module owns only `BrowserContext` lifecycle, not `Browser` lifecycle.
   */
  readonly browser: Browser;
  readonly baseUrl: string;
  /** Output directory, already resolved to an absolute path (`output.directory`). */
  readonly outputDirectory: string;
  readonly outputStructure?: "flat" | "run" | "scope";
  readonly runId?: string | undefined;
  readonly fullPage: boolean;
  readonly routes: readonly RawRoute[];
  readonly runs: readonly RawRun[];
  /**
   * Provided by the caller (RFC-007): required only when a route resolved by
   * the plan has a user. `undefined` when no route in the configuration
   * requires authentication.
   */
  readonly auth?: AuthAdapter | undefined;
  readonly timeoutMs?: number;
  /**
   * Maximum number of snapshot jobs — one per run, one per standalone route —
   * executed simultaneously (RFC-014). Defaults to `1` (strictly sequential),
   * so every caller that does not opt in keeps the historical behavior
   * unchanged, including run/standalone ordering and per-context session
   * reuse. `runSnapshots` passes the resolved `execution.concurrency`.
   */
  readonly concurrency?: number;
  /** Output collision strategy (RFC-014.5). Defaults to `serialize`. */
  readonly collision?: CollisionHandling;
}

/** Shared fail-fast gate: once a job fails, jobs not yet started are skipped. */
interface FailFastState {
  stopped: boolean;
}

/**
 * Per-capture execution directive derived from the collision strategy:
 * - `defer`: hold the capture back for interactive phase-2 resolution;
 * - `serialize`: capture at its path, but gated so conflicting captures never
 *   write concurrently.
 * Safe captures have no directive and run normally.
 */
type CaptureDirective =
  | { readonly kind: "defer" }
  | { readonly kind: "serialize"; readonly gate: SerializeGate };

type DirectiveMap = ReadonlyMap<string, CaptureDirective>;

interface RunJobResult {
  readonly kind: "run";
  readonly result: RunSnapshotResult;
  readonly failure: SnapshotFailure | undefined;
}

interface StandaloneJobResult {
  readonly kind: "standalone";
  readonly snapshot: CapturedSnapshot | undefined;
  readonly failure: SnapshotFailure | undefined;
}

interface SkippedJobResult {
  readonly kind: "skipped";
}

type SnapshotJobResult = RunJobResult | StandaloneJobResult | SkippedJobResult;

/**
 * Execute Playwright captures (RFC-009) from the typed execution plan
 * (RFC-008), through a bounded-concurrency scheduler (RFC-014), with output
 * collision handling layered above the scheduler (RFC-014.5).
 *
 * Two distinct concepts, intentionally kept separate (RFC-014.5):
 *
 * - **Execution job** (the RFC-014 scheduler boundary): one *run*, or one
 *   *standalone route*. A run job owns a single isolated `BrowserContext` and
 *   captures its routes strictly sequentially, with lazy per-user
 *   authentication cached on that context (login once per run, route order and
 *   session reuse preserved). Collision handling never splits a run into
 *   independently authenticated per-route jobs — the only place an individual
 *   capture is replayed on its own context is the explicit post-prompt
 *   resolution phase ({@link captureDeferred}).
 * - **Collision resource**: a single fully resolved output path. Collisions are
 *   detected between individual run-captures ({@link RunCapturePlan}) by path,
 *   but that inspection does not change the execution job boundary above.
 *
 * Runs come first (in plan order), then standalone routes; results are
 * re-associated by job index, so the report is deterministic regardless of
 * completion order.
 *
 * Output collisions — two captures resolving to the same file path — are
 * detected before scheduling (never inside the generic scheduler). When none
 * exist, execution is byte-for-byte identical to RFC-014. Otherwise the
 * configured strategy applies: `error` aborts before any conflicting write,
 * `serialize` gates conflicting captures so they never write concurrently
 * (unrelated captures stay parallel, global concurrency respected), and
 * interactive `prompt` defers conflicting captures then resolves them per the
 * user's choice.
 *
 * Fail-fast is preserved (first failure stops starting new jobs). Unexpected
 * infrastructure errors (for example `browser.newContext()` throwing) propagate
 * out of this function so the caller can shut the browser down.
 */
export async function captureSnapshots(options: CaptureSnapshotsOptions): Promise<SnapshotReport> {
  const startedAt = Date.now();
  const structure = options.outputStructure ?? "flat";
  const plan = buildExecutionPlan(options.runs, options.routes);
  const standaloneRoutes = selectStandaloneRoutes(options.routes, options.runs);
  const concurrency = options.concurrency ?? 1;
  const collision = options.collision ?? { strategy: "serialize", interactive: false };

  const runCaptures = planRunCaptures(plan, {
    outputDirectory: options.outputDirectory,
    structure,
    runId: options.runId,
  });
  const capturesByRun = groupCapturesByRun(runCaptures);
  const groups = detectCollisions(runCaptures);

  // Planning-time abort (RFC-014.5 §7 error / §10 non-interactive prompt).
  // No screenshot is produced.
  if (
    groups.length > 0 &&
    (collision.strategy === "error" ||
      (collision.strategy === "prompt" && !collision.interactive))
  ) {
    throw new ConfigOutputCollisionError(formatCollisions(groups));
  }

  const directives = buildDirectives(groups, collision.strategy);

  // Scheduler jobs keep the RFC-014 boundary: exactly one job per run and one
  // per standalone route. Collision directives only influence how a run's
  // routes are captured *within* its single context — never the job count.
  const state: FailFastState = { stopped: false };
  const jobs: (() => Promise<SnapshotJobResult>)[] = [
    ...plan.map((plannedRun) =>
      createRunJob(plannedRun.runName, capturesByRun.get(plannedRun.runName) ?? [], options, state, directives),
    ),
    ...standaloneRoutes.map((route) => createStandaloneJob(route, options, state)),
  ];

  const outcomes = await runWithConcurrency(jobs, concurrency);

  // Infrastructure error path (RFC-014 §13/§15): a rejected outcome is not a
  // capture failure. Propagate the first one so the caller closes the browser.
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      throw outcome.reason;
    }
  }

  const runs: RunSnapshotResult[] = [];
  const standalone: CapturedSnapshot[] = [];
  let failure: SnapshotFailure | undefined;

  for (const outcome of outcomes) {
    if (outcome.status !== "fulfilled") {
      continue;
    }

    const value = outcome.value;

    if (value.kind === "run") {
      runs.push(value.result);
      if (value.failure !== undefined && failure === undefined) {
        failure = value.failure;
      }
    } else if (value.kind === "standalone") {
      if (value.snapshot !== undefined) {
        standalone.push(value.snapshot);
      }
      if (value.failure !== undefined && failure === undefined) {
        failure = value.failure;
      }
    }
  }

  // Interactive collision resolution (RFC-014.5 §7). Only when phase 1 fully
  // succeeded: a real failure takes precedence over collision resolution.
  let skipped: readonly SkippedCapture[] | undefined;

  if (
    collision.strategy === "prompt" &&
    collision.interactive &&
    groups.length > 0 &&
    failure === undefined
  ) {
    const resolution = await resolveCollisionsInteractively(collision.prompt, groups);
    const deferred = runCaptures.filter((capture) => directives.get(capture.captureId)?.kind === "defer");

    if (resolution === "skip") {
      skipped = deferred.map((capture) => ({
        routeId: capture.routeId,
        runName: capture.runName,
        filePath: capture.filePath,
        reason: "collision" as const,
      }));
    } else {
      const relocated =
        resolution === "create-subfolders" ? buildSubfolderPaths(groups) : undefined;
      failure = await captureDeferred(runs, deferred, relocated, options);
      // `captureDeferred` mutated `runs` entries in place; keep the same array.
    }
  }

  const collisions: readonly OutputCollision[] = groups.map((group) => ({
    filePath: group.filePath,
    captures: group.captures.map((capture) => ({
      routeId: capture.routeId,
      runName: capture.runName,
    })),
  }));

  return {
    succeeded: failure === undefined,
    durationMs: Date.now() - startedAt,
    runs,
    standalone,
    failure,
    ...(collisions.length > 0 ? { collisions } : {}),
    ...(skipped !== undefined ? { skipped } : {}),
  };
}

/** Group run-captures by their run name, preserving each run's capture order. */
function groupCapturesByRun(
  captures: readonly RunCapturePlan[],
): ReadonlyMap<string, RunCapturePlan[]> {
  const byRun = new Map<string, RunCapturePlan[]>();

  for (const capture of captures) {
    const existing = byRun.get(capture.runName);
    if (existing === undefined) {
      byRun.set(capture.runName, [capture]);
    } else {
      existing.push(capture);
    }
  }

  return byRun;
}

/** Map each colliding capture to its execution directive for the active strategy. */
function buildDirectives(
  groups: readonly CollisionGroup[],
  strategy: CollisionStrategy,
): DirectiveMap {
  const directives = new Map<string, CaptureDirective>();

  if (groups.length === 0) {
    return directives;
  }

  if (strategy === "serialize") {
    const gates = buildSerializeGates(groups);
    for (const [captureId, gate] of gates) {
      directives.set(captureId, { kind: "serialize", gate });
    }
  } else if (strategy === "prompt") {
    for (const group of groups) {
      for (const capture of group.captures) {
        directives.set(capture.captureId, { kind: "defer" });
      }
    }
  }

  return directives;
}

/**
 * Build a job capturing one run: its routes are captured sequentially inside a
 * single isolated context (preserving RFC-008 run semantics and login-once-
 * per-context authentication). `serialize` gates for this run's captures are
 * always released in a `finally`, so a skipped or failed job never deadlocks a
 * conflicting capture in another job (RFC-014.5).
 */
function createRunJob(
  runName: string,
  captures: readonly RunCapturePlan[],
  options: CaptureSnapshotsOptions,
  state: FailFastState,
  directives: DirectiveMap,
): () => Promise<SnapshotJobResult> {
  return async () => {
    if (state.stopped) {
      releaseGates(captures, directives);
      return { kind: "skipped" };
    }

    try {
      const outcome = await captureRun(runName, captures, options, directives);

      if (outcome.failure !== undefined) {
        state.stopped = true;
      }

      return {
        kind: "run",
        result: { runName, snapshots: outcome.snapshots },
        failure: outcome.failure,
      };
    } catch (error) {
      state.stopped = true;
      throw error;
    } finally {
      releaseGates(captures, directives);
    }
  };
}

/** Idempotently release every serialize gate owned by this run's captures. */
function releaseGates(captures: readonly RunCapturePlan[], directives: DirectiveMap): void {
  for (const capture of captures) {
    const directive = directives.get(capture.captureId);
    if (directive?.kind === "serialize") {
      directive.gate.done();
    }
  }
}

/**
 * Build a job capturing one standalone route (a route enabled but not
 * referenced by any run) in its own isolated context. Standalone captures
 * never collide (route ids are unique), so they carry no collision directive.
 */
function createStandaloneJob(
  route: RawRoute,
  options: CaptureSnapshotsOptions,
  state: FailFastState,
): () => Promise<SnapshotJobResult> {
  return async () => {
    if (state.stopped) {
      return { kind: "skipped" };
    }

    const structure = options.outputStructure ?? "flat";
    const filePath = computeSnapshotFilePath(options.outputDirectory, {
      structure,
      kind: "standalone",
      routeId: route.id,
      scope: route.scope,
      runId: options.runId,
    });

    try {
      const outcome = await withIsolatedContext(options.browser, (context) =>
        capturePlannedRoute(context, { route, user: route.user }, filePath, undefined, options),
      );

      if (outcome.failure !== undefined) {
        state.stopped = true;
        return { kind: "standalone", snapshot: undefined, failure: outcome.failure };
      }

      return { kind: "standalone", snapshot: outcome.snapshot, failure: undefined };
    } catch (error) {
      state.stopped = true;
      throw error;
    }
  };
}

interface RunCaptureResult {
  readonly snapshots: readonly CapturedSnapshot[];
  readonly failure: SnapshotFailure | undefined;
}

async function captureRun(
  runName: string,
  captures: readonly RunCapturePlan[],
  options: CaptureSnapshotsOptions,
  directives: DirectiveMap,
): Promise<RunCaptureResult> {
  return withIsolatedContext(options.browser, async (context) => {
    const snapshots: CapturedSnapshot[] = [];

    for (const capture of captures) {
      const directive = directives.get(capture.captureId);

      // Deferred captures are held back for interactive resolution (phase 2).
      if (directive?.kind === "defer") {
        continue;
      }

      if (directive?.kind === "serialize" && directive.gate.before !== undefined) {
        await directive.gate.before;
      }

      let outcome;
      try {
        outcome = await capturePlannedRoute(
          context,
          capture.plannedRoute,
          capture.filePath,
          runName,
          options,
        );
      } finally {
        if (directive?.kind === "serialize") {
          directive.gate.done();
        }
      }

      if (outcome.failure !== undefined) {
        return { snapshots, failure: outcome.failure };
      }

      snapshots.push(outcome.snapshot);
    }

    return { snapshots, failure: undefined };
  });
}

/**
 * Execute the deferred (conflicting) captures sequentially, in deterministic
 * order, for the "Re-run", "Overwrite", and "Create subfolders" resolutions.
 *
 * This is the single, explicit exception to the run job boundary (RFC-014.5):
 * these conflicting captures were held back from their run's normal sequential
 * pass and are now replayed individually, each in its own isolated context
 * (re-authenticating if needed). It runs only after interactive confirmation
 * and only for captures that genuinely conflict; the standard run lifecycle for
 * every non-conflicting capture is untouched.
 *
 * Successful captures are appended to their run's snapshot list (mutating the
 * `runs` entries in place). Returns the first failure encountered, if any.
 */
async function captureDeferred(
  runs: readonly RunSnapshotResult[],
  deferred: readonly RunCapturePlan[],
  relocated: ReadonlyMap<string, string> | undefined,
  options: CaptureSnapshotsOptions,
): Promise<SnapshotFailure | undefined> {
  const snapshotsByRun = new Map<string, CapturedSnapshot[]>(
    runs.map((run) => [run.runName, run.snapshots as CapturedSnapshot[]]),
  );

  for (const capture of deferred) {
    const targetPath = relocated?.get(capture.captureId) ?? capture.filePath;

    const outcome = await withIsolatedContext(options.browser, (context) =>
      capturePlannedRoute(context, capture.plannedRoute, targetPath, capture.runName, options),
    );

    if (outcome.failure !== undefined) {
      return outcome.failure;
    }

    snapshotsByRun.get(capture.runName)?.push(outcome.snapshot);
  }

  return undefined;
}

/** Resolve the collision queue via the injected prompt, or abort if none is available. */
async function resolveCollisionsInteractively(
  prompt: CollisionPrompt | undefined,
  groups: readonly CollisionGroup[],
): ReturnType<CollisionPrompt> {
  if (prompt === undefined) {
    // Interactive strategy requested without a prompt: treat as `error`.
    throw new ConfigOutputCollisionError(formatCollisions(groups));
  }

  return prompt(groups);
}

/**
 * Single creation/closure point for `BrowserContext` instances (RFC-009): every
 * run and every standalone route creates its own isolated context through this
 * function. `context.close()` always runs in the `finally` block, so no context
 * can remain open after a call regardless of the failure cause. Because every
 * job owns its own context, concurrent jobs never share context or session
 * state.
 */
async function withIsolatedContext<T>(
  browser: Browser,
  work: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext();

  try {
    return await work(context);
  } finally {
    await context.close();
  }
}

interface PlannedRouteCaptureOutcome {
  readonly snapshot: CapturedSnapshot;
  readonly failure: undefined;
}

interface PlannedRouteCaptureFailure {
  readonly snapshot: undefined;
  readonly failure: SnapshotFailure;
}

/** Authenticate if needed, then capture a route on a dedicated page in the given context. */
async function capturePlannedRoute(
  context: BrowserContext,
  plannedRoute: Pick<PlannedRoute, "route" | "user">,
  filePath: string,
  runName: string | undefined,
  options: CaptureSnapshotsOptions,
): Promise<PlannedRouteCaptureOutcome | PlannedRouteCaptureFailure> {
  const { route, user } = plannedRoute;
  const startedAt = Date.now();

  try {
    if (user !== undefined) {
      if (options.auth === undefined) {
        throw new SnapshotFailedError(route.id, {
          cause: new Error(`No authentication adapter was provided for user: ${user}`),
        });
      }

      try {
        await options.auth.login(context, user);
      } catch (error) {
        throw new SnapshotFailedError(route.id, { cause: error });
      }
    }

    const page = await context.newPage();
    try {
      await captureRoute({
        page,
        baseUrl: options.baseUrl,
        route,
        filePath,
        fullPage: options.fullPage,
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      });
    } catch (error) {
      throw new SnapshotFailedError(route.id, { cause: error });
    } finally {
      await page.close();
    }

    return {
      snapshot: { routeId: route.id, filePath, durationMs: Date.now() - startedAt },
      failure: undefined,
    };
  } catch (error) {
    return {
      snapshot: undefined,
      failure: { routeId: route.id, runName, message: toFailureMessage(error) },
    };
  }
}

/** Keep the concrete failure reason (`cause`) in reports, not the generic {@link SnapshotFailedError} message. */
function toFailureMessage(error: unknown): string {
  if (error instanceof SnapshotFailedError) {
    return error.cause instanceof Error ? error.cause.message : String(error.cause);
  }

  return error instanceof Error ? error.message : String(error);
}
