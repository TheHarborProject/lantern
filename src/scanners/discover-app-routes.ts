import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import {
  isDynamicSegment,
  isInterceptingRouteSegment,
  isRouteGroupSegment,
} from "./parse-route-segment.js";

const RECOGNIZED_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const PAGE_BASENAME = "page";
const EXCLUDED_BASENAMES = new Set([
  "layout",
  "loading",
  "error",
  "template",
  "default",
  "route",
  "not-found",
  "global-error",
]);

/** Discover pages in an App Router directory (`app/` or `src/app/`). */
export async function discoverAppRoutes(appDir: string): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  await walk(appDir, []);
  return routes;

  async function walk(currentDir: string, urlSegments: readonly string[]): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Private folders (_), parallel slots (@), and intercepting routes
        // ((.), (..), (..)(..), (...)) are never traversed. For intercepting
        // routes, the canonical URL depends on how many levels are traversed
        // relative to the directory position, which is not resolved in V1
        // (RFC-005). Excluding them from the scan is the only safe way to
        // avoid generating a nonexistent URL segment such as `(.)photo` or
        // `(..)modal`.
        if (
          entry.name.startsWith("_") ||
          entry.name.startsWith("@") ||
          isInterceptingRouteSegment(entry.name)
        ) {
          continue;
        }

        const nextSegments = isRouteGroupSegment(entry.name)
          ? urlSegments
          : [...urlSegments, entry.name];

        await walk(join(currentDir, entry.name), nextSegments);
        continue;
      }

      const extension = extname(entry.name);
      const basename = entry.name.slice(0, entry.name.length - extension.length);

      if (!RECOGNIZED_EXTENSIONS.has(extension) || EXCLUDED_BASENAMES.has(basename)) {
        continue;
      }

      if (basename !== PAGE_BASENAME) {
        continue;
      }

      routes.push({
        path: `/${urlSegments.join("/")}`,
        filePath: join(currentDir, entry.name),
        router: "app",
        isDynamic: urlSegments.some(isDynamicSegment),
      });
    }
  }
}
