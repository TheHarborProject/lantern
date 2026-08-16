import { z } from "zod";

/**
 * Central, named reusable value lists a component prop can reference instead of
 * repeating explicit values inline (RFC-006).
 *
 * Fixtures stay data-only and minimal on purpose: a fixture is just a named,
 * reusable array of explicit values living in `lantern.config.json` — not a
 * plugin/runtime system, not a companion file, not an import/module reference.
 * A component prop opts into a fixture through `components.<name>.props.<prop>.fixture`
 * (see {@link ../schemas/components.js}), which is resolved against this map.
 */
export const fixturesSchema = z.record(z.string(), z.array(z.unknown()));

/** Validated `fixtures` section, inferred from {@link fixturesSchema}. */
export type FixturesConfig = z.infer<typeof fixturesSchema>;
