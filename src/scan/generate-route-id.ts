const ROOT_PATH_ID = "home";

function slugifyPath(path: string): string {
  const withoutCatchAllSyntax = path.replace(/\[\.\.\.([^\]]+)\]/g, "$1");
  const withoutBrackets = withoutCatchAllSyntax.replace(/[[\]]/g, "");

  const segments = withoutBrackets.split("/").filter((segment) => segment.length > 0);

  return segments.length > 0 ? segments.join("-") : ROOT_PATH_ID;
}

/**
 * Generate a readable route id from its path, unique relative to ids that
 * have already been used (RFC-006).
 */
export function generateRouteId(path: string, usedIds: ReadonlySet<string>): string {
  const base = slugifyPath(path);

  if (!usedIds.has(base)) {
    return base;
  }

  let suffix = 2;
  while (usedIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}
