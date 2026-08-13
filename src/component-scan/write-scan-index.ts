import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ComponentScanError } from "../errors/component-scan-error.js";
import type { ComponentScanIndex } from "../types/component-scan.js";

export const SCAN_INDEX_PATH = join(".lantern", "scan.json");

/** Atomically replace the regenerable component index. */
export function writeScanIndex(projectRoot: string, index: ComponentScanIndex): string {
  const filePath = join(projectRoot, SCAN_INDEX_PATH);
  const tempPath = join(dirname(filePath), `.scan-${process.pid}-${Date.now()}.tmp`);
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(tempPath, `${JSON.stringify(index, null, 2)}\n`, "utf-8");
    renameSync(tempPath, filePath);
  } catch (cause) {
    throw new ComponentScanError(`Could not write component index: ${filePath}`, { cause });
  }
  return filePath;
}
