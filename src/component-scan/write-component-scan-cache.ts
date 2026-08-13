import type { CanonicalComponentModel } from "../types/component-scan.js";
import { COMPONENT_SCAN_CACHE_PATH } from "./artifact-paths.js";
import { writeJsonArtifact } from "./write-json-artifact.js";

export { COMPONENT_SCAN_CACHE_PATH };

/** Atomically replace the exhaustive internal component model. */
export function writeComponentScanCache(projectRoot: string, model: CanonicalComponentModel): string {
  return writeJsonArtifact(projectRoot, COMPONENT_SCAN_CACHE_PATH, model);
}
