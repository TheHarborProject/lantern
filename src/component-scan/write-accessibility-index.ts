import type { AccessibilityIndex } from "../types/component-scan.js";
import { ACCESSIBILITY_INDEX_PATH } from "./artifact-paths.js";
import { writeJsonArtifact } from "./write-json-artifact.js";

export { ACCESSIBILITY_INDEX_PATH };

/** Atomically replace the accessibility projection. */
export function writeAccessibilityIndex(projectRoot: string, index: AccessibilityIndex): string {
  return writeJsonArtifact(projectRoot, ACCESSIBILITY_INDEX_PATH, index);
}
