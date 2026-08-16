import { z } from "zod";

/**
 * Explicit configuration for a single component prop (RFC-005, extended by RFC-006).
 *
 * The extension point exists so component-state generation (RFC-006) can
 * consume explicit user choices Lantern cannot safely infer from
 * TypeScript/component discovery — without Storybook-style companion files.
 * `values` carries explicit prop values inline; `fixture` instead references a
 * named, reusable value list declared once in the central `fixtures` section
 * (RFC-006). Configuring both is rejected as ambiguous: exactly one source of
 * explicit truth per prop keeps resolution deterministic. The scanner remains
 * the source of truth for whatever Lantern can discover automatically, and
 * explicit user configuration always overrides inferred values.
 */
const componentPropConfigSchema = z
  .object({
    values: z.array(z.unknown()).optional(),
    fixture: z.string().optional(),
  })
  .strict()
  .superRefine((prop, ctx) => {
    if (prop.values !== undefined && prop.fixture !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: 'A prop cannot configure both "values" and "fixture"; pick exactly one explicit source.',
        path: ["fixture"],
      });
    }
  });

/**
 * Explicit configuration for a single discovered component, keyed by component
 * name. `props` overrides/augments per-prop information; `fixtures` reserves the
 * future direction of fixture references. `skip` explicitly opts a component out
 * of state generation (RFC-006) — distinct from an unresolved component, which
 * still requires configuration. All fields are optional so a component entry
 * only carries what the user chose to state.
 */
const componentConfigSchema = z
  .object({
    props: z.record(z.string(), componentPropConfigSchema).optional(),
    fixtures: z.array(z.string()).optional(),
    skip: z.boolean().optional(),
  })
  .strict();

/** A map of component name to explicit component configuration. */
export const componentsSchema = z.record(z.string(), componentConfigSchema);

/** Validated configuration for one component prop. */
export type ComponentPropConfig = z.infer<typeof componentPropConfigSchema>;

/** Validated configuration for one component. */
export type ComponentConfig = z.infer<typeof componentConfigSchema>;

/** Validated `components` section, inferred from {@link componentsSchema}. */
export type ComponentsConfig = z.infer<typeof componentsSchema>;
