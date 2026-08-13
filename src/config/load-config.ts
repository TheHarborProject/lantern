import { rememberConfigPath, resolveConfigPath } from "./resolve-config-path.js";
import { readConfigFile } from "./read-config-file.js";
import { resolveConfigPaths } from "./resolve-config-paths.js";
import { validateConfig } from "./validate-config.js";
import type { ResolvedConfig } from "../types/config.js";

export interface LoadConfigOptions {
  readonly cwd: string;
  readonly explicitPath?: string | undefined;
  readonly onWarning?: ((message: string) => void) | undefined;
}

/**
 * Locate, read, validate, and resolve the SnapRun configuration.
 *
 * @throws {ConfigNotFoundError} No configuration file was found.
 * @throws {ConfigInvalidError} JSON is invalid or does not match the schema.
 */
export function loadConfig(options: LoadConfigOptions): ResolvedConfig {
  const resolvedConfigPath = resolveConfigPath({
    cwd: options.cwd,
    explicitConfigPath: options.explicitPath,
    onWarning: options.onWarning,
  });
  const rawData = readConfigFile(resolvedConfigPath.path);
  const config = validateConfig(rawData, resolvedConfigPath.path);

  if (resolvedConfigPath.source === "explicit") {
    rememberConfigPath(options.cwd, resolvedConfigPath.path);
  }

  return resolveConfigPaths(config, resolvedConfigPath.path);
}
