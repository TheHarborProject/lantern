import { z } from "zod";

/**
 * Configurable engine capabilities (RFC-005).
 *
 * Engines are implementation capabilities that can be enabled or disabled; they
 * are NOT the public rule namespace. A rule ID such as `lantern/color-contrast`
 * never changes when an engine is toggled — engine selection and rule policy are
 * deliberately decoupled so future engines can be added without users rewriting
 * their Lantern rule IDs.
 *
 * Defaults are conservative and honest about current capability: only `static`
 * (the discovery/analysis Lantern already performs) is enabled by default.
 * `axe` and `lighthouse` are reserved for later RFCs and default to `false`;
 * this RFC does NOT implement any engine execution.
 */
export const enginesSchema = z
  .object({
    static: z.boolean().default(true),
    axe: z.boolean().default(false),
    lighthouse: z.boolean().default(false),
  })
  .strict();

/** Validated `engines` section, inferred from {@link enginesSchema}. */
export type EngineConfig = z.infer<typeof enginesSchema>;
