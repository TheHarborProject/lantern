import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";

/**
 * Content-hash every discovered source file, keyed by its portable,
 * project-relative path (RFC-007). Used only for change detection — never a
 * place for durable user decisions.
 */
export function hashSourceFiles(root: string, sourceFiles: readonly string[]): Record<string, string> {
  const hashes: Record<string, string> = {};

  for (const filePath of sourceFiles) {
    const relativePath = toPortablePath(relative(root, filePath));
    hashes[relativePath] = createHash("sha1").update(readFileSync(filePath)).digest("hex");
  }

  return hashes;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}
