import type { RawConfig, ResolvedLanternConfig } from "../../types/config.js";
import { LANTERN_DEFAULTS } from "./lantern-defaults.js";
import { mergeFragment, type ConfigFragment } from "./merge-fragments.js";
import { PRESETS } from "./presets.js";

/**
 * Resolve the RFC-005 accessibility configuration from raw configuration by
 * layering, in this deterministic order:
 *
 *   1. Lantern defaults
 *   2. `extends` presets, in declared order
 *   3. top-level project configuration
 *
 * Matching `overrides` form a fourth, per-target layer applied later by
 * {@link resolveRulesForFile}; they are preserved here as an ordered list. The
 * result is fully populated so consumers never re-derive defaults.
 */
export function resolveLanternConfig(raw: RawConfig): ResolvedLanternConfig {
  let resolved = LANTERN_DEFAULTS;

  for (const presetId of raw.extends ?? []) {
    resolved = mergeFragment(resolved, PRESETS[presetId]);
  }

  const projectFragment: ConfigFragment = {
    standards: raw.standards,
    engines: raw.engines,
    settings: raw.settings,
    rules: raw.rules,
    components: raw.components,
    overrides: raw.overrides,
    ignorePatterns: raw.ignorePatterns,
  };
  resolved = mergeFragment(resolved, projectFragment);

  return { ...resolved, extends: [...(raw.extends ?? [])] };
}
