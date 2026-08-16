import type { z } from "zod";
import type { ComponentsConfig } from "../schemas/components.js";
import type { configSchema } from "../schemas/config.js";
import type { EngineConfig } from "../schemas/engines.js";
import type { ExtendsConfig } from "../schemas/extends.js";
import type { FixturesConfig } from "../schemas/fixtures.js";
import type { OverridesConfig } from "../schemas/overrides.js";
import type { RulesConfig } from "../schemas/rules.js";
import type { SettingsConfig } from "../schemas/settings.js";
import type { StandardsConfig } from "../schemas/standards.js";

/**
 * Raw configuration: direct result of Zod validation.
 *
 * Schema defaults (for example `project.autoStart`) are already applied, but paths (`project.root`,
 * `project.workingDirectory`) stay relative exactly as written in the
 * configuration file. RFC-005 accessibility sections stay optional here: they
 * are defaulted, extended and merged only in the resolution layer, so raw
 * configuration is never conflated with resolved configuration.
 */
export type RawConfig = z.infer<typeof configSchema>;

/**
 * Fully resolved RFC-005 accessibility configuration.
 *
 * Produced by layering, in this order: Lantern defaults, `extends` presets (in
 * declared order), then the top-level project configuration. Every field is
 * populated. `overrides` are kept as an ordered list so per-target rule
 * resolution can apply matching overrides deterministically at lint time.
 */
export interface ResolvedLanternConfig {
  readonly standards: StandardsConfig;
  readonly extends: ExtendsConfig;
  readonly engines: EngineConfig;
  readonly settings: SettingsConfig;
  readonly rules: RulesConfig;
  readonly components: ComponentsConfig;
  readonly overrides: OverridesConfig;
  readonly ignorePatterns: readonly string[];
  readonly fixtures: FixturesConfig;
}

/**
 * Resolved configuration: derived from {@link RawConfig} by replacing
 * `project.root` and `project.workingDirectory` with absolute paths (RFC-002)
 * and by resolving the RFC-005 accessibility sections into their fully merged,
 * defaulted form. Commands consume this form.
 */
export interface ResolvedConfig extends ResolvedLanternConfig, Pick<RawConfig, "auth" | "isolation"> {
  readonly configFilePath: string;
  readonly project: Omit<RawConfig["project"], "root" | "workingDirectory"> & {
    readonly root: string;
    readonly workingDirectory: string;
  };
}
