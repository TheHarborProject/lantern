import type { DiscoveredRoute } from "../types/discovered-route.js";
import { FilesystemRouteScanner } from "./filesystem-route-scanner.js";
import type { RouteScanner } from "./scanner.js";

/**
 * Stable facade used by the rest of SnapRun (RFC-005). Delegates to an
 * internal engine, currently `FilesystemRouteScanner`. Replacing the engine
 * (for example with a future `NextListRouteScanner` or
 * `NextManifestRouteScanner`) happens here without changing callers of
 * `NextjsRouteScanner`.
 */
export class NextjsRouteScanner implements RouteScanner {
  private readonly engine: RouteScanner;

  constructor(engine: RouteScanner = new FilesystemRouteScanner()) {
    this.engine = engine;
  }

  async scan(projectRoot: string): Promise<DiscoveredRoute[]> {
    return this.engine.scan(projectRoot);
  }
}
