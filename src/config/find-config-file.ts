import { resolveConfigPath } from "./resolve-config-path.js";

export interface FindConfigFileOptions {
  readonly cwd: string;
  readonly explicitPath?: string | undefined;
  readonly onWarning?: ((message: string) => void) | undefined;
}

/**
 * Locate the configuration file to load.
 *
 * `explicitPath` (`--config`) takes precedence over automatic detection.
 * Otherwise, search `cwd` in the order defined by {@link CONFIG_FILE_NAMES}.
 */
export function findConfigFile(options: FindConfigFileOptions): string {
  return resolveConfigPath({
    cwd: options.cwd,
    explicitConfigPath: options.explicitPath,
    onWarning: options.onWarning,
  }).path;
}
