import type { DiscoveredRoute } from "../types/discovered-route.js";

/**
 * Minimal contract for a route discovery engine (RFC-005). Intentionally
 * lightweight, with no multi-framework architecture: one Next.js engine at a time.
 */
export interface RouteScanner {
  scan(projectRoot: string): Promise<DiscoveredRoute[]>;
}
