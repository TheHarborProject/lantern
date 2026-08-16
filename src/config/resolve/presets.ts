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
 * `lantern:recommended` enables Lantern's documented core rule IDs at sensible
 * severities. This is configuration policy (like `eslint:recommended`), not a
 * claim that these rules already execute — this RFC implements no rule
 * execution. The catalog stays intentionally small.
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
