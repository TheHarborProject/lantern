import { rememberConfigPath, resolveConfigPath } from "../config/resolve-config-path.js";
import { readConfigFile } from "../config/read-config-file.js";
import { resolveConfigPaths } from "../config/resolve-config-paths.js";
import { validateConfig } from "../config/validate-config.js";
import { writeConfigFile } from "../config/write-config-file.js";
import { NextjsRouteScanner } from "../scanners/nextjs-route-scanner.js";
import type { RouteScanner } from "../scanners/scanner.js";
import type { ScanResult } from "../types/scan-result.js";
import { mergeDiscoveredRoutes } from "./merge-discovered-routes.js";
import { replaceRoutesInRawConfig } from "./replace-routes-in-raw-config.js";

export interface RunScanOptions {
  readonly cwd: string;
  readonly explicitConfigPath?: string | undefined;
  /** `enableSnapshot` value to use for new routes (the `--default` option). */
  readonly defaultEnableSnapshot: boolean;
  /** Injectable for tests; defaults to `NextjsRouteScanner`. */
  readonly scanner?: RouteScanner | undefined;
  readonly onWarning?: ((message: string) => void) | undefined;
}

/**
 * Execute `snaprun scan` (RFC-006): discover project routes, merge them into
 * the existing configuration (add only new routes, report obsolete routes
 * without deleting them), and write the file atomically only when new routes
 * were added, changing only the `routes` key.
 *
 * @throws {ConfigNotFoundError} No configuration file was found.
 * @throws {ConfigInvalidError} Configuration is invalid before or after merge.
 */
export async function runScan(options: RunScanOptions): Promise<ScanResult> {
  const configResolution = resolveConfigPath({
    cwd: options.cwd,
    explicitConfigPath: options.explicitConfigPath,
    onWarning: options.onWarning,
  });
  const rawConfig = readConfigFile(configResolution.path);
  const validatedConfig = validateConfig(rawConfig, configResolution.path);
  const resolvedConfig = resolveConfigPaths(validatedConfig, configResolution.path);

  if (configResolution.source === "explicit") {
    rememberConfigPath(options.cwd, configResolution.path);
  }

  const scanner = options.scanner ?? new NextjsRouteScanner();
  const discoveredRoutes = await scanner.scan(resolvedConfig.project.root);

  const { added, unchanged, obsolete, unsupportedCatchAll, mergedRoutes } = mergeDiscoveredRoutes(
    validatedConfig.routes,
    discoveredRoutes,
    options.defaultEnableSnapshot,
  );

  let fileModified = false;

  if (added.length > 0) {
    const nextRawConfig = replaceRoutesInRawConfig(rawConfig, mergedRoutes);
    validateConfig(nextRawConfig, configResolution.path);
    writeConfigFile(configResolution.path, nextRawConfig);
    fileModified = true;
  }

  return {
    configFilePath: configResolution.path,
    added,
    unchanged,
    obsolete,
    unsupportedCatchAll,
    fileModified,
  };
}
