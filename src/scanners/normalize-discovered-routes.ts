import type { DiscoveredRoute } from "../types/discovered-route.js";

/**
 * Deduplicate by final path (App Router wins over Pages Router on collision,
 * just like Next.js itself) and sort deterministically (RFC-005: stable
 * output).
 */
export function normalizeDiscoveredRoutes(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  const byPath = new Map<string, DiscoveredRoute>();

  for (const route of routes) {
    const existing = byPath.get(route.path);

    if (existing === undefined || (existing.router === "pages" && route.router === "app")) {
      byPath.set(route.path, route);
    }
  }

  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
