import { hasCatchAllSegment } from "../scanners/parse-route-segment.js";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import type { RawRoute } from "../types/route.js";
import { createRouteFromDiscovery } from "./create-route-from-discovery.js";

export interface MergeDiscoveredRoutesResult {
  readonly added: readonly RawRoute[];
  readonly unchanged: readonly RawRoute[];
  /** Existing routes not found by the scan: reported, never removed automatically. */
  readonly obsolete: readonly RawRoute[];
  /**
   * Catch-all (`[...slug]`) or optional catch-all (`[[...slug]]`) routes
   * discovered without an existing match: never added automatically to
   * `routes` because RFC-004/005 cannot build a concrete URL for them yet.
   * They are only reported as unsupported.
   */
  readonly unsupportedCatchAll: readonly DiscoveredRoute[];
  /** `existingRoutes` keeps its order, and `added` is always appended (RFC-006). */
  readonly mergedRoutes: readonly RawRoute[];
}

/**
 * Merge discovered routes with existing configured routes (RFC-006). Routes
 * are matched by `path`:
 * - an existing route that is rediscovered stays unchanged (id,
 *   enableSnapshot, user, parameters, snapshotPath, order), including a
 *   catch-all route that was already configured manually;
 * - a discovered route with no existing match is added, unless it contains a
 *   catch-all segment (see `unsupportedCatchAll`);
 * - an existing route that is not rediscovered is reported as obsolete and
 *   is never removed automatically.
 */
export function mergeDiscoveredRoutes(
  existingRoutes: readonly RawRoute[],
  discoveredRoutes: readonly DiscoveredRoute[],
  defaultEnableSnapshot: boolean,
): MergeDiscoveredRoutesResult {
  const existingByPath = new Map(existingRoutes.map((route) => [route.path, route]));
  const discoveredPaths = new Set(discoveredRoutes.map((route) => route.path));
  const usedIds = new Set(existingRoutes.map((route) => route.id));

  const added: RawRoute[] = [];
  const unchanged: RawRoute[] = [];
  const unsupportedCatchAll: DiscoveredRoute[] = [];

  for (const discovered of discoveredRoutes) {
    const existing = existingByPath.get(discovered.path);

    if (existing !== undefined) {
      unchanged.push(existing);
      continue;
    }

    if (hasCatchAllSegment(discovered.path)) {
      unsupportedCatchAll.push(discovered);
      continue;
    }

    const newRoute = createRouteFromDiscovery(discovered, usedIds, defaultEnableSnapshot);
    usedIds.add(newRoute.id);
    added.push(newRoute);
  }

  const obsolete = existingRoutes.filter((route) => !discoveredPaths.has(route.path));

  return {
    added,
    unchanged,
    obsolete,
    unsupportedCatchAll,
    mergedRoutes: [...existingRoutes, ...added],
  };
}
