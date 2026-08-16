import type { OverridesConfig } from "../../schemas/overrides.js";
import type { RulesConfig } from "../../schemas/rules.js";
import { matchesAnyGlob } from "../glob-match.js";

interface RuleResolutionInput {
  readonly rules: RulesConfig;
  readonly overrides: OverridesConfig;
}

/**
 * Resolve the effective rule policy for a single project-relative path
 * (RFC-005).
 *
 * Starting from the resolved top-level rules, each matching override is applied
 * in declared array order — a later matching override wins per rule id. Matching
 * is deterministic: an override matches when any of its `files` globs match the
 * path. Overrides that do not match are ignored entirely.
 */
export function resolveRulesForFile(config: RuleResolutionInput, relativePath: string): RulesConfig {
  let rules: RulesConfig = { ...config.rules };

  for (const override of config.overrides) {
    if (matchesAnyGlob(relativePath, override.files)) {
      rules = { ...rules, ...(override.rules ?? {}) };
    }
  }

  return rules;
}
