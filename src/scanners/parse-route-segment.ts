export type RouteSegmentKind = "static" | "dynamic" | "catch-all" | "optional-catch-all";

export interface ParsedRouteSegment {
  readonly kind: RouteSegmentKind;
}

const OPTIONAL_CATCH_ALL_PATTERN = /^\[\[\.\.\.[A-Za-z_][A-Za-z0-9_]*]]$/;
const CATCH_ALL_PATTERN = /^\[\.\.\.[A-Za-z_][A-Za-z0-9_]*]$/;
const DYNAMIC_PATTERN = /^\[[A-Za-z_][A-Za-z0-9_]*]$/;

/**
 * Classify a Next.js route segment (directory name or file name without an
 * extension): static, dynamic (`[id]`), catch-all (`[...slug]`), or optional
 * catch-all (`[[...slug]]`).
 *
 * Single extension point (RFC-005) for future complete catch-all resolution.
 * For now, catch-all segments are recognized but not resolved.
 */
export function parseRouteSegment(segment: string): ParsedRouteSegment {
  if (OPTIONAL_CATCH_ALL_PATTERN.test(segment)) {
    return { kind: "optional-catch-all" };
  }

  if (CATCH_ALL_PATTERN.test(segment)) {
    return { kind: "catch-all" };
  }

  if (DYNAMIC_PATTERN.test(segment)) {
    return { kind: "dynamic" };
  }

  return { kind: "static" };
}

/** A segment is dynamic whenever it is not classified as `static`. */
export function isDynamicSegment(segment: string): boolean {
  return parseRouteSegment(segment).kind !== "static";
}

/**
 * True when a full path (for example `/docs/[...slug]`) contains a catch-all
 * or optional catch-all segment. Their resolution (building a concrete URL)
 * is not supported by RFC-004/005, so this detector lets RFC-006 avoid
 * auto-registering them in `routes` as if they needed no parameters.
 */
export function hasCatchAllSegment(path: string): boolean {
  return path
    .split("/")
    .some((segment) =>
      ["catch-all", "optional-catch-all"].includes(parseRouteSegment(segment).kind),
    );
}

/** True for an App Router route-group directory such as `(marketing)`. */
export function isRouteGroupSegment(segment: string): boolean {
  return /^\([^/]+\)$/.test(segment);
}

/**
 * App Router intercepting route markers (`(.)`, `(..)`, `(..)(..)`,
 * `(...)`), always prefixed directly onto the intercepted segment name
 * (for example `(.)photo`).
 *
 * RFC-005 (V1): their canonical URL cannot be determined correctly without
 * resolving how many levels are traversed relative to the directory
 * position. That is not implemented here. This function exists only to
 * detect them and exclude them safely from scanning (see
 * `discoverAppRoutes`), never to turn them into URL segments.
 */
const INTERCEPTING_ROUTE_PREFIXES = ["(..)(..)", "(...)", "(..)", "(.)"] as const;

export function isInterceptingRouteSegment(segment: string): boolean {
  return INTERCEPTING_ROUTE_PREFIXES.some((prefix) => segment.startsWith(prefix));
}
