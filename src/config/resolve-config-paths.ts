import { dirname, resolve } from "node:path";
import type { RawConfig, ResolvedConfig } from "../types/config.js";
import { resolveLanternConfig } from "./resolve/resolve-lantern-config.js";

/**
 * Resolve `project.root` (relative to the configuration file) and
 * `project.workingDirectory` (relative to `root`) into absolute paths, and
 * resolve the RFC-005 accessibility configuration (`standards`, `extends`,
 * `engines`, `settings`, `rules`, `components`, `overrides`, `ignorePatterns`)
 * into its fully merged, defaulted form. This is the single place raw
 * configuration becomes the resolved configuration commands consume.
 */
export function resolveConfigPaths(config: RawConfig, configFilePath: string): ResolvedConfig {
  const configDir = dirname(configFilePath);
  const rootDir = resolve(configDir, config.project.root);
  const workingDirectory = resolve(rootDir, config.project.workingDirectory);

  return {
    ...config,
    ...resolveLanternConfig(config),
    configFilePath,
    project: {
      ...config.project,
      root: rootDir,
      workingDirectory,
    },
  };
}
