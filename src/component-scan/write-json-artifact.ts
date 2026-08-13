import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ComponentScanError } from "../errors/component-scan-error.js";

/**
 * Atomically write a deterministic JSON artifact under the project root.
 *
 * The value is serialized with stable 2-space indentation and a trailing
 * newline, written to a temporary sibling, then renamed into place so readers
 * never observe a partial file.
 */
export function writeJsonArtifact(projectRoot: string, relativePath: string, value: unknown): string {
  const filePath = join(projectRoot, relativePath);
  const tempPath = join(dirname(filePath), `.${basename(relativePath)}-${process.pid}-${Date.now()}.tmp`);
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
    renameSync(tempPath, filePath);
  } catch (cause) {
    throw new ComponentScanError(`Could not write component artifact: ${filePath}`, { cause });
  }
  return filePath;
}

function basename(relativePath: string): string {
  return relativePath.split(/[\\/]/).at(-1) ?? "artifact";
}
