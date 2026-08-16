import { z } from "zod";
import { rulesSchema } from "./rules.js";

/**
 * A single contextual override, inspired by ESLint `overrides` (RFC-005).
 *
 * `files` lists glob patterns; an override matches a discovery target when any
 * of its patterns match the target's project-relative path. Rules inside an
 * override use the exact same configuration format as top-level `rules`.
 *
 * Precedence is deterministic: overrides are applied in declared array order
 * after the resolved top-level rules, so a later matching override wins. The
 * schema is kept extensible so future RFCs can target component/state-specific
 * contexts without a second configuration system.
 */
const overrideSchema = z
  .object({
    files: z.array(z.string()).nonempty("An override must list at least one file pattern."),
    rules: rulesSchema.optional(),
  })
  .strict();

/** Ordered list of contextual overrides. */
export const overridesSchema = z.array(overrideSchema);

/** Validated single override. */
export type Override = z.infer<typeof overrideSchema>;

/** Validated `overrides` section, inferred from {@link overridesSchema}. */
export type OverridesConfig = z.infer<typeof overridesSchema>;
