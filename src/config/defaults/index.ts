import type { LanternConfig } from "../../schemas/config.js";
import {
  defaultExtendsConfig,
  defaultIgnorePatternsConfig,
  defaultStandardsConfig,
} from "./accessibility.js";
import { defaultAuthConfig } from "./auth.js";
import { defaultIsolationConfig } from "./isolation.js";
import { defaultProjectConfig } from "./project.js";

/** Build a fresh starter configuration for Lantern. */
export function createDefaultConfig(): LanternConfig {
  return {
    output: { mode: "compact" },
    project: { ...defaultProjectConfig },
    auth: {
      ...defaultAuthConfig,
      selectors: { ...defaultAuthConfig.selectors },
      users: { ...defaultAuthConfig.users },
    },
    isolation: {
      ...defaultIsolationConfig,
      globalCss: [...defaultIsolationConfig.globalCss],
    },
    standards: [...defaultStandardsConfig],
    extends: [...defaultExtendsConfig],
    ignorePatterns: [...defaultIgnorePatternsConfig],
  };
}
