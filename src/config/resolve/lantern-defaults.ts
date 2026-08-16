import type { ResolvedLanternConfig } from "../../types/config.js";

/**
 * Base Lantern defaults — the first layer of configuration resolution (RFC-005).
 *
 * Chosen conservatively so a user need not configure every field, without
 * claiming runtime capabilities Lantern does not yet have:
 * - one default standard (`wcag22-aa`) as a requested evaluation context, not a
 *   promise of automated proof;
 * - only the `static` engine enabled (the discovery Lantern already performs);
 * - no rules enabled by default — rules are opted into via `extends`
 *   (e.g. `lantern:recommended`) or listed explicitly;
 * - no fixtures declared by default (RFC-006) — fixtures are reusable named
 *   value lists a project defines only once it needs them.
 *
 * This value is treated as immutable; resolution never mutates it in place.
 */
export const LANTERN_DEFAULTS: ResolvedLanternConfig = {
  standards: ["wcag22-aa"],
  extends: [],
  engines: { static: true, axe: false, lighthouse: false },
  settings: {},
  rules: {},
  components: {},
  overrides: [],
  ignorePatterns: [],
  fixtures: {},
};
