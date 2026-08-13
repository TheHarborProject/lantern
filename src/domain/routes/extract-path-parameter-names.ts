/**
 * Recognized dynamic segment: `[name]` (RFC-004).
 *
 * Single extension point for RFC-005: Next.js `[...slug]` (catch-all) and
 * `[[...slug]]` (optional catch-all) segments can be added here without
 * changing callers such as the validation schema or path resolver.
 */
const PARAMETER_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;

/** Extract path parameter names in appearance order, without duplicates. */
export function extractPathParameterNames(path: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const match of path.matchAll(PARAMETER_PATTERN)) {
    const name = match[1];
    if (name !== undefined && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}
