import type { ExtendsConfig } from "../../schemas/extends.js";
import type { IgnorePatternsConfig } from "../../schemas/ignore-patterns.js";
import type { StandardsConfig } from "../../schemas/standards.js";

/**
 * Starter RFC-005 accessibility sections for Lantern. Kept intentionally small:
 * `engines`, `rules`, `settings`, `components` and `overrides` already resolve
 * to useful values without being spelled out (see the resolution layer under
 * `src/config/resolve/`), so the scaffolded file only shows the fields a new
 * project most likely wants to see and adapt immediately.
 */
export const defaultStandardsConfig: StandardsConfig = ["wcag22-aa"];

export const defaultExtendsConfig: ExtendsConfig = ["lantern:recommended"];

export const defaultIgnorePatternsConfig: IgnorePatternsConfig = [
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
];
