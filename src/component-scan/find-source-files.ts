import { readdirSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { matchesAnyGlob } from "../config/glob-match.js";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".lantern",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

/**
 * Obvious non-component sources safe to skip entirely: tooling configuration
 * files whose default export is a config object, not a React component. Skipping
 * them avoids noisy "not a component" diagnostics. Genuinely ambiguous sources
 * are still scanned so their partial-analysis diagnostics are retained.
 */
const CONFIG_FILE_PATTERN = /(?:^|\.)config\.(?:c|m)?tsx?$/;
const IGNORED_FILE_NAMES = new Set([
  "vitest.workspace.ts",
  "vitest.workspace.tsx",
]);

function isConfigLikeFile(name: string): boolean {
  return CONFIG_FILE_PATTERN.test(name) || IGNORED_FILE_NAMES.has(name);
}

/**
 * Find TypeScript sources in stable path order without following symlinks.
 *
 * `ignorePatterns` (RFC-005 `ignorePatterns`) are project-relative glob
 * patterns layered on top of the always-ignored directories below — they can
 * exclude additional user-specific paths but can never resurrect `.lantern/`
 * or the other built-in exclusions, which stay component-discovery-proof
 * regardless of configuration.
 */
export function findSourceFiles(root: string, ignorePatterns: readonly string[] = []): string[] {
  const files: string[] = [];
  visit(root, root, files, ignorePatterns);
  return files.sort(compareText);
}

function visit(root: string, directory: string, files: string[], ignorePatterns: readonly string[]): void {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    compareText(left.name, right.name),
  );

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const path = join(directory, entry.name);
    const relativePath = relative(root, path).split(sep).join("/");
    if (ignorePatterns.length > 0 && matchesAnyGlob(relativePath, ignorePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        visit(root, path, files, ignorePatterns);
      }
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(extname(entry.name)) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !isConfigLikeFile(entry.name)
    ) {
      files.push(path);
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
