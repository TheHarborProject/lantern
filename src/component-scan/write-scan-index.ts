import type { ComponentScanIndex } from "../types/component-scan.js";
import { SCAN_INDEX_PATH } from "./artifact-paths.js";
import { writeJsonArtifact } from "./write-json-artifact.js";

export { SCAN_INDEX_PATH };

/** Atomically replace the human-readable component index. */
export function writeScanIndex(projectRoot: string, index: ComponentScanIndex): string {
  return writeJsonArtifact(projectRoot, SCAN_INDEX_PATH, index);
}
