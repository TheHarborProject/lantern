import type { CheckResult } from "../lint/types.js";
import { AuditCancelledError } from "../lint/events.js";
import { matchEngine } from "./match-engine.js";
import type { Engine, EngineExecutionContext, PlannedCheck } from "./types.js";

export interface ExecutedCheck {
  readonly check: PlannedCheck;
  readonly result: CheckResult;
}

/**
 * Execute planned checks against capability-matched engines (RFC-008/009.1).
 *
 * Sequential and deterministic by planned-check order: concurrency is future
 * work (RFC-008 explicitly defers it), so browser/engine completion order can
 * never leak into result ordering. A check with no matching engine never
 * calls `execute` — it normalizes straight to a truthful `review` outcome
 * (never a silent pass). A genuine engine failure (thrown, not returned) is
 * caught per check: it becomes a `review` result with
 * `outcomeReason: "operational-error"` carrying the failing check's own
 * identity, so one check's engine exception never discards results already
 * collected for other checks, states, or components. Cancellation
 * (`AuditCancelledError`) is never reclassified this way — it always
 * propagates to the caller unchanged.
 */
export async function executePlannedChecks(
  checks: readonly PlannedCheck[],
  engines: readonly Engine[],
  contextFor: (check: PlannedCheck) => EngineExecutionContext,
): Promise<readonly ExecutedCheck[]> {
  const executed: ExecutedCheck[] = [];
  for (const check of checks) {
    const matched = matchEngine(check, engines);
    if ("reason" in matched) {
      executed.push({ check, result: unsupportedResult(check, matched.reason) });
      continue;
    }
    const startedAt = Date.now();
    try {
      const result = await matched.engine.execute(check, contextFor(check));
      executed.push({ check, result: { ...result, durationMs: Date.now() - startedAt } });
    } catch (error) {
      if (error instanceof AuditCancelledError) {
        throw error;
      }
      executed.push({ check, result: operationalErrorResult(check, matched.engine, error, Date.now() - startedAt) });
    }
  }
  return executed;
}

function operationalErrorResult(check: PlannedCheck, engine: Engine, error: unknown, durationMs: number): CheckResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    checkId: check.checkId,
    componentId: check.componentId,
    stateId: check.stateId,
    ruleId: check.ruleId,
    severity: check.severity,
    status: "review",
    outcomeReason: "operational-error",
    message: `"${check.ruleId}" could not be evaluated for "${check.component}" due to an operational error.`,
    reason: message,
    engine: { name: engine.identity.id, version: engine.identity.version },
    evidence: [{ kind: "observation", name: "operationalError", value: message }],
    durationMs,
  };
}

function unsupportedResult(check: PlannedCheck, reason: string): CheckResult {
  return {
    checkId: check.checkId,
    componentId: check.componentId,
    stateId: check.stateId,
    ruleId: check.ruleId,
    severity: check.severity,
    status: "review",
    outcomeReason: "unsupported",
    message: `"${check.ruleId}" could not be automatically evaluated for "${check.component}".`,
    reason,
    evidence: [{ kind: "capability", required: check.requiredCapability, attempts: parseAttempts(reason) }],
    durationMs: 0,
  };
}

function parseAttempts(reason: string): readonly { readonly engine: string; readonly reason: string }[] {
  const details = reason.match(/\((.*)\)\.$/)?.[1];
  if (details === undefined) return [];
  return details.split("; ").map((attempt) => {
    const separator = attempt.indexOf(": ");
    return separator < 0
      ? { engine: "unknown", reason: attempt }
      : { engine: attempt.slice(0, separator), reason: attempt.slice(separator + 2) };
  });
}
