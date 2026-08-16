import type { ComponentConfig, ComponentsConfig } from "../../schemas/components.js";
import type { EngineConfig } from "../../schemas/engines.js";
import type { OverridesConfig } from "../../schemas/overrides.js";
import type { RulesConfig } from "../../schemas/rules.js";
import type { SettingsConfig } from "../../schemas/settings.js";
import type { StandardsConfig } from "../../schemas/standards.js";
import type { ResolvedLanternConfig } from "../../types/config.js";

/**
 * A partial configuration layer applied during resolution: Lantern defaults, an
 * `extends` preset, or the top-level project configuration. Only fields a layer
 * declares are present; absent fields leave the previous layer untouched.
 */
export interface ConfigFragment {
  readonly standards?: StandardsConfig | undefined;
  readonly engines?: Partial<EngineConfig> | undefined;
  readonly settings?: SettingsConfig | undefined;
  readonly rules?: RulesConfig | undefined;
  readonly components?: ComponentsConfig | undefined;
  readonly overrides?: OverridesConfig | undefined;
  readonly ignorePatterns?: readonly string[] | undefined;
}

function mergeComponentConfig(base: ComponentConfig, next: ComponentConfig): ComponentConfig {
  const props =
    base.props !== undefined || next.props !== undefined
      ? { ...(base.props ?? {}), ...(next.props ?? {}) }
      : undefined;
  const merged: ComponentConfig = { ...base, ...next };
  if (props !== undefined) {
    return { ...merged, props };
  }
  return merged;
}

function mergeComponents(base: ComponentsConfig, next: ComponentsConfig): ComponentsConfig {
  const result: Record<string, ComponentConfig> = { ...base };
  for (const [name, config] of Object.entries(next)) {
    const existing = result[name];
    result[name] = existing === undefined ? config : mergeComponentConfig(existing, config);
  }
  return result;
}

/**
 * Merge a resolved base with the next fragment using explicit, deterministic
 * rules (RFC-005):
 * - `standards`, `ignorePatterns` (arrays): the later layer replaces;
 * - `engines`, `settings`, `rules` (maps): shallow merge by key, later wins;
 * - `components`: merge by component name, then by prop name;
 * - `overrides` (array): concatenate, preserving declared order.
 *
 * `extends` is carried through unchanged — it records the declared preset list
 * on the resolved config rather than being merged.
 */
export function mergeFragment(base: ResolvedLanternConfig, next: ConfigFragment): ResolvedLanternConfig {
  return {
    standards: [...(next.standards ?? base.standards)],
    extends: base.extends,
    engines: { ...base.engines, ...next.engines },
    settings: { ...base.settings, ...next.settings },
    rules: { ...base.rules, ...next.rules },
    components: mergeComponents(base.components, next.components ?? {}),
    overrides: [...base.overrides, ...(next.overrides ?? [])],
    ignorePatterns: [...(next.ignorePatterns ?? base.ignorePatterns)],
  };
}
