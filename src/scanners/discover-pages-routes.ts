import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { DiscoveredRoute } from "../types/discovered-route.js";
import { isDynamicSegment } from "./parse-route-segment.js";

const RECOGNIZED_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const INDEX_BASENAME = "index";
const EXCLUDED_BASENAMES = new Set(["_app", "_document", "_error", "_middleware"]);
const API_DIRECTORY = "api";

/** Discover pages in a Pages Router directory (`pages/` or `src/pages/`). */
export async function discoverPagesRoutes(pagesDir: string): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  await walk(pagesDir, [], true);
  return routes;

  async function walk(
    currentDir: string,
    urlSegments: readonly string[],
    isRoot: boolean,
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isRoot && entry.name === API_DIRECTORY) {
          continue;
        }

        await walk(join(currentDir, entry.name), [...urlSegments, entry.name], false);
        continue;
      }

      const extension = extname(entry.name);
      const basename = entry.name.slice(0, entry.name.length - extension.length);

      if (!RECOGNIZED_EXTENSIONS.has(extension) || EXCLUDED_BASENAMES.has(basename)) {
        continue;
      }

      const segments = basename === INDEX_BASENAME ? urlSegments : [...urlSegments, basename];

      routes.push({
        path: `/${segments.join("/")}`,
        filePath: join(currentDir, entry.name),
        router: "pages",
        isDynamic: segments.some(isDynamicSegment),
      });
    }
  }
}
