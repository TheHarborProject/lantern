import type { RuleConfig, RulesConfig, Severity } from "../schemas/rules.js";

/**
 * Extract each rule's configured severity, ESLint-style: a bare severity or a
 * `[severity, options]` tuple both resolve to the severity; `"off"` rules are
 * dropped entirely so downstream planning never has to special-case them.
 */
export function resolveActiveRules(rules: RulesConfig): ReadonlyMap<string, Exclude<Severity, "off">> {
  const active = new Map<string, Exclude<Severity, "off">>();
  for (const [ruleId, config] of Object.entries(rules)) {
    const severity = ruleSeverity(config);
    if (severity !== "off") {
      active.set(ruleId, severity);
    }
  }
  return active;
}

function ruleSeverity(config: RuleConfig): Severity {
  return Array.isArray(config) ? config[0] : config;
}
