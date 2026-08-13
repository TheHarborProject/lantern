import { join } from "node:path";

/** Human-readable projection. */
export const SCAN_INDEX_PATH = join(".lantern", "scan.json");

/** Accessibility projection. */
export const ACCESSIBILITY_INDEX_PATH = join(".lantern", "accessibility.json");

/** Exhaustive canonical model (internal cache). */
export const COMPONENT_SCAN_CACHE_PATH = join(".lantern", "cache", "component-scan.json");
