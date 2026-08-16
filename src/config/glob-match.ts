/**
 * Minimal, deterministic glob matcher shared by `ignorePatterns` filtering and
 * `overrides` file matching (RFC-005). It is intentionally small — only what the
 * configuration contract needs — rather than a full gitignore/minimatch engine.
 *
 * Semantics (paths compared with `/` separators, project-relative):
 * - `**` matches any characters, including path separators;
 * - `*`  matches any characters except `/` (a single path segment);
 * - `?`  matches a single character except `/`;
 * - a pattern that contains a `/` (other than a trailing one) is anchored at the
 *   start of the path; a pattern without one may match at any directory depth;
 * - a trailing `/` marks a directory pattern (`dist/`), matching that directory
 *   and everything beneath it. File patterns also match a matched path and any
 *   descendant, so `dist` and `dist/` both exclude files under `dist/`.
 */

function escapeRegExpLiteral(char: string): string {
  return char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  const withoutTrailingSlash = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  const anchored = withoutTrailingSlash.includes("/");

  let body = "";
  for (let index = 0; index < withoutTrailingSlash.length; index += 1) {
    const char = withoutTrailingSlash.charAt(index);
    if (char === "*") {
      if (withoutTrailingSlash.charAt(index + 1) === "*") {
        body += ".*";
        index += 1;
      } else {
        body += "[^/]*";
      }
    } else if (char === "?") {
      body += "[^/]";
    } else {
      body += escapeRegExpLiteral(char);
    }
  }

  const prefix = anchored ? "^" : "^(?:.*/)?";
  // Trailing `(?:/.*)?` lets a directory/segment pattern also match descendants.
  return new RegExp(`${prefix}${body}(?:/.*)?$`);
}

/** Match a single project-relative path against a single glob pattern. */
export function matchesGlob(path: string, pattern: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\.\//, "");
  return globToRegExp(pattern).test(normalizedPath);
}

/** Match a path against any of the given patterns. */
export function matchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}
