import type { Engine, PlannedCheck } from "./types.js";

export type EngineMatch = { readonly engine: Engine } | { readonly reason: string };

/**
 * Deterministic capability matching (RFC-008): the first enabled engine (in
 * declared array order) that declares support wins. No `if/else` on a
 * concrete engine name lives here or anywhere downstream — engines are only
 * ever consulted through {@link Engine.supports}.
 */
export function matchEngine(check: PlannedCheck, engines: readonly Engine[]): EngineMatch {
  if (engines.length === 0) {
    return { reason: `No engines are enabled to evaluate "${check.ruleId}".` };
  }

  const attempts: string[] = [];
  for (const engine of engines) {
    const support = engine.supports(check);
    if (support.kind === "supported") {
      return { engine };
    }
    attempts.push(`${engine.identity.id}: ${support.reason}`);
  }
  return {
    reason: `No enabled engine supports "${check.ruleId}" (${attempts.join("; ")}).`,
  };
}
