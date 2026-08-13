/** Source Next.js router for a discovered route. */
export type RouterKind = "app" | "pages";

/**
 * Route discovered by a {@link RouteScanner} (RFC-005). `path` keeps literal
 * dynamic segments (`[id]`, `[...slug]`, `[[...slug]]`) so it stays
 * compatible with the route model syntax expected by RFC-004.
 */
export interface DiscoveredRoute {
  readonly path: string;
  readonly filePath: string;
  readonly router: RouterKind;
  readonly isDynamic: boolean;
}
