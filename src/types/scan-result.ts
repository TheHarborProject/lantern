import type { DiscoveredRoute } from "./discovered-route.js";
import type { RawRoute } from "./route.js";

/** Result of a `snaprun scan` merge (RFC-006). */
export interface ScanResult {
  readonly configFilePath: string;
  readonly added: readonly RawRoute[];
  readonly unchanged: readonly RawRoute[];
  /** Routes present in configuration but not found by the scan: reported, never deleted. */
  readonly obsolete: readonly RawRoute[];
  /** Discovered catch-all routes, never added automatically because they are unsupported. */
  readonly unsupportedCatchAll: readonly DiscoveredRoute[];
  readonly fileModified: boolean;
}
