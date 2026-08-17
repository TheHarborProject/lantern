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
 *
 * Matching uses dynamic programming instead of constructing a regular
 * expression. Its runtime is O(pattern length × path length), including for
 * adversarial runs of overlapping wildcards.
 */

type GlobToken =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "single" }
  | { readonly kind: "segment-star" }
  | { readonly kind: "glob-star" };

/** Match a single project-relative path against a single glob pattern. */
export function matchesGlob(path: string, pattern: string): boolean {
  const normalizedPath = normalize(path);
  const normalizedPattern = normalize(pattern);
  const withoutTrailingSlash = normalizedPattern.endsWith("/")
    ? normalizedPattern.slice(0, -1)
    : normalizedPattern;
  const anchored = withoutTrailingSlash.includes("/");
  let reachable = initialPositions(normalizedPath, anchored);

  for (const token of tokenize(withoutTrailingSlash)) {
    reachable = advance(reachable, normalizedPath, token);
  }

  return reachable.some(
    (matches, index) =>
      matches && (index === normalizedPath.length || normalizedPath[index] === "/"),
  );
}

/** Match a path against any of the given patterns. */
export function matchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

function normalize(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function tokenize(pattern: string): GlobToken[] {
  const tokens: GlobToken[] = [];

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    if (char === "*") {
      if (pattern.charAt(index + 1) === "*") {
        tokens.push({ kind: "glob-star" });
        index += 1;
      } else {
        tokens.push({ kind: "segment-star" });
      }
    } else if (char === "?") {
      tokens.push({ kind: "single" });
    } else {
      tokens.push({ kind: "literal", value: char });
    }
  }

  return tokens;
}

function initialPositions(path: string, anchored: boolean): boolean[] {
  const positions = Array<boolean>(path.length + 1).fill(false);
  positions[0] = true;

  if (!anchored) {
    for (let index = 0; index < path.length; index += 1) {
      if (path[index] === "/") {
        positions[index + 1] = true;
      }
    }
  }

  return positions;
}

function advance(reachable: readonly boolean[], path: string, token: GlobToken): boolean[] {
  const next = Array<boolean>(path.length + 1).fill(false);

  if (token.kind === "segment-star" || token.kind === "glob-star") {
    for (let index = 0; index <= path.length; index += 1) {
      if (reachable[index]) {
        next[index] = true;
      }
      if (
        index < path.length &&
        next[index] &&
        (token.kind === "glob-star" || path[index] !== "/")
      ) {
        next[index + 1] = true;
      }
    }
    return next;
  }

  for (let index = 0; index < path.length; index += 1) {
    if (!reachable[index]) {
      continue;
    }
    if (
      (token.kind === "single" && path[index] !== "/") ||
      (token.kind === "literal" && path[index] === token.value)
    ) {
      next[index + 1] = true;
    }
  }

  return next;
}
