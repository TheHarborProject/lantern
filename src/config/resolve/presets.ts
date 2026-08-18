import type { PresetId } from "../../schemas/extends.js";
import type { ConfigFragment } from "./merge-fragments.js";

/**
 * Built-in Lantern presets loadable via `extends` (RFC-005).
 *
 * A preset is a reusable configuration fragment merged during resolution,
 * before the top-level project configuration. Presets configure Lantern-owned
 * rule policy only — they never reference engine-native rule IDs and never
 * couple configuration to a specific engine.
 *
 * `lantern:recommended` enables Lantern's broader documented catalog at
 * sensible severities, including rules whose engine support is still
 * incomplete. Stable standard-derived defaults are resolved separately from
 * authoritative registry metadata. The catalog stays intentionally small.
 */
export const PRESETS: Record<PresetId, ConfigFragment> = {
  "lantern:recommended": {
    rules: {
      "lantern/accessible-name": "error",
      "lantern/color-contrast": "error",
      "lantern/focus-visible": "warn",
      "lantern/keyboard-access": "error",
    },
  },
};
