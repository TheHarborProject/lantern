import type { CheckResult } from "../lint/types.js";
import type { Engine, PlannedCheck, SupportResult } from "./types.js";

/**
 * Lantern's static engine (RFC-008): evaluates `lantern/accessible-name`
 * directly from the accessibility projection (RFC-004) already computed
 * during discovery — no rendering. It never claims more than static evidence
 * can prove: a component with no accessible-name-capable prop at all is a
 * genuine, provable defect (`fail`); one that does expose such a prop can
 * only be confirmed by rendering or manual review (`review`), never assumed
 * `pass`.
 */
export const LANTERN_STATIC_ENGINE_ID = "lantern-static";
export const LANTERN_STATIC_ENGINE_VERSION = "1.0.0";

const SUPPORTED_RULE_ID = "lantern/accessible-name";

export function createStaticEngine(): Engine {
  return {
    identity: { id: LANTERN_STATIC_ENGINE_ID, version: LANTERN_STATIC_ENGINE_VERSION },
    capabilities: ["static-evidence"],
    supports(check: PlannedCheck): SupportResult {
      if (check.requiredCapability !== "static-evidence" || check.ruleId !== SUPPORTED_RULE_ID) {
        return { kind: "unsupported", reason: `${LANTERN_STATIC_ENGINE_ID} does not evaluate "${check.ruleId}".` };
      }
      return { kind: "supported" };
    },
    execute(check: PlannedCheck): Promise<CheckResult> {
      const engine = { name: LANTERN_STATIC_ENGINE_ID, version: LANTERN_STATIC_ENGINE_VERSION };
      const location = { file: check.source };

      if (check.accessibility.accessibleNameSources.length === 0) {
        return Promise.resolve({
          checkId: check.checkId,
          componentId: check.componentId,
          stateId: check.stateId,
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" is focusable but exposes no prop capable of providing an accessible name (e.g. aria-label, aria-labelledby, label, alt, title, name, placeholder, or children).`,
          location,
          engine,
          evidence: [{ kind: "observation", name: "accessibleNameSources", value: [] }],
          durationMs: 0,
        });
      }

      return Promise.resolve({
        checkId: check.checkId,
        componentId: check.componentId,
        stateId: check.stateId,
        ruleId: check.ruleId,
        severity: check.severity,
        status: "review",
        message: `"${check.component}" exposes an accessible-name-capable prop (${check.accessibility.accessibleNameSources.join(", ")}); static analysis cannot confirm one is actually supplied at runtime.`,
        location,
        engine,
        outcomeReason: "inconclusive",
        reason: "Static evidence only proves the capability exists, not that a name is populated for any given usage — verify manually or enable rendered evaluation.",
        evidence: [{ kind: "observation", name: "accessibleNameSources", value: check.accessibility.accessibleNameSources }],
        durationMs: 0,
      });
    },
  };
}
