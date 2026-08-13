import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

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

/** Find TypeScript sources in stable path order without following symlinks. */
export function findSourceFiles(root: string): string[] {
  const files: string[] = [];
  visit(root, files);
  return files.sort(compareText);
}

function visit(directory: string, files: string[]): void {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    compareText(left.name, right.name),
  );

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        visit(path, files);
      }
      continue;
    }

    if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(extname(entry.name)) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(path);
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
