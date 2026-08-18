import type { ResolvedLanternConfig } from "../../types/config.js";

/**
 * Base Lantern defaults — the first layer of configuration resolution (RFC-005).
 *
 * Chosen conservatively so a user need not configure every field, without
 * claiming runtime capabilities Lantern does not yet have:
 * - one default standard (`wcag22-aa`) as a requested evaluation context, not a
 *   promise of automated proof;
 * - the Lantern-owned `static` and `rendered` engines enabled (RFC-008);
 *   third-party engines (`axe`, `lighthouse`) stay opt-in;
 * - the base object contains no fixed rule map because stable defaults are
 *   derived from the selected standards by `resolveLanternConfig`;
 * - no fixtures declared by default (RFC-006) — fixtures are reusable named
 *   value lists a project defines only once it needs them.
 *
 * This value is treated as immutable; resolution never mutates it in place.
 */
export const LANTERN_DEFAULTS: ResolvedLanternConfig = {
  output: { mode: "compact" },
  standards: ["wcag22-aa"],
  extends: [],
  engines: { static: true, rendered: true, axe: false, lighthouse: false },
  settings: {},
  rules: {},
  components: {},
  overrides: [],
  ignorePatterns: [],
  fixtures: {},
  survey: {
    scan: { nonInteractive: "refresh" },
    persistence: { local: true, ci: false },
    git: { capture: true },
    history: { path: ".lantern/surveys", listMax: 20 },
  },
};
