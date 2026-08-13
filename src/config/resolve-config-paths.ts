import { dirname, resolve } from "node:path";
import type { RawConfig, ResolvedConfig } from "../types/config.js";

/**
 * Resolve `project.root` (relative to the configuration file) and
 * `project.workingDirectory` (relative to `root`) into absolute paths.
 */
export function resolveConfigPaths(config: RawConfig, configFilePath: string): ResolvedConfig {
  const configDir = dirname(configFilePath);
  const rootDir = resolve(configDir, config.project.root);
  const workingDirectory = resolve(rootDir, config.project.workingDirectory);

  return {
    ...config,
    configFilePath,
    project: {
      ...config.project,
      root: rootDir,
      workingDirectory,
    },
  };
}
