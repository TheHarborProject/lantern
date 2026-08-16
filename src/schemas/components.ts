import { z } from "zod";

/**
 * Explicit configuration for a single component prop (RFC-005).
 *
 * The extension point exists so future component-state generation (RFC-006) can
 * consume explicit user choices Lantern cannot safely infer from
 * TypeScript/component discovery — without Storybook-style companion files.
 * `values` carries explicit prop values; the scanner remains the source of
 * truth for whatever Lantern can discover automatically, and explicit user
 * configuration must ultimately be able to override inferred values.
 *
 * This RFC only defines the schema; it does NOT implement inference, Cartesian
 * state generation, or fixture execution.
 */
const componentPropConfigSchema = z
  .object({
    values: z.array(z.unknown()).optional(),
  })
  .strict();

/**
 * Explicit configuration for a single discovered component, keyed by component
 * name. `props` overrides/augments per-prop information; `fixtures` reserves the
 * future direction of fixture references. Both are optional so a component entry
 * only carries what the user chose to state.
 */
const componentConfigSchema = z
  .object({
    props: z.record(z.string(), componentPropConfigSchema).optional(),
    fixtures: z.array(z.string()).optional(),
  })
  .strict();

/** A map of component name to explicit component configuration. */
export const componentsSchema = z.record(z.string(), componentConfigSchema);

/** Validated configuration for one component. */
export type ComponentConfig = z.infer<typeof componentConfigSchema>;

/** Validated `components` section, inferred from {@link componentsSchema}. */
export type ComponentsConfig = z.infer<typeof componentsSchema>;
