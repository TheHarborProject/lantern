import type { DiscoveredRoute } from "../types/discovered-route.js";
import { discoverAppRoutes } from "./discover-app-routes.js";
import { discoverPagesRoutes } from "./discover-pages-routes.js";
import { findRouterDirectory } from "./find-router-directory.js";
import { normalizeDiscoveredRoutes } from "./normalize-discovered-routes.js";
import type { RouteScanner } from "./scanner.js";

const APP_DIRECTORY_CANDIDATES = ["app", "src/app"];
const PAGES_DIRECTORY_CANDIDATES = ["pages", "src/pages"];

/**
 * Native route scanner (RFC-005): detect App Router and Pages Router by
 * following the official Next.js directory conventions, with no external
 * dependency. Both routers are scanned when they coexist (incremental
 * migration).
 */
export class FilesystemRouteScanner implements RouteScanner {
  async scan(projectRoot: string): Promise<DiscoveredRoute[]> {
    const appDir = await findRouterDirectory(projectRoot, APP_DIRECTORY_CANDIDATES);
    const pagesDir = await findRouterDirectory(projectRoot, PAGES_DIRECTORY_CANDIDATES);

    const appRoutes = appDir !== undefined ? await discoverAppRoutes(appDir) : [];
    const pagesRoutes = pagesDir !== undefined ? await discoverPagesRoutes(pagesDir) : [];

    return normalizeDiscoveredRoutes([...appRoutes, ...pagesRoutes]);
  }
}
