import type { CheckResult } from "../lint/types.js";
import { matchEngine } from "./match-engine.js";
import type { Engine, EngineExecutionContext, PlannedCheck } from "./types.js";

export interface ExecutedCheck {
  readonly check: PlannedCheck;
  readonly result: CheckResult;
}

/**
 * Execute planned checks against capability-matched engines (RFC-008).
 *
 * Sequential and deterministic by planned-check order: concurrency is future
 * work (RFC-008 explicitly defers it), so browser/engine completion order can
 * never leak into result ordering. A check with no matching engine never
 * calls `execute` — it normalizes straight to a truthful `review` outcome
 * (never a silent pass). A genuine engine failure (thrown, not returned) is
 * left to propagate: it is an operational failure, not an accessibility
 * result, and the caller is expected to let it abort the run (RFC-007 exit
 * code `2`) rather than fabricate a check outcome for it.
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
    const result = await matched.engine.execute(check, contextFor(check));
    executed.push({ check, result });
  }
  return executed;
}

function unsupportedResult(check: PlannedCheck, reason: string): CheckResult {
  return {
    ruleId: check.ruleId,
    severity: check.severity,
    status: "review",
    message: `"${check.ruleId}" could not be automatically evaluated for "${check.component}".`,
    reason,
  };
}
