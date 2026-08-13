import { z } from "zod";

/**
 * `output` section. Optional as a whole, with defaults applied when the
 * section or one of its fields is omitted (RFC-006/RFC-009).
 */
export const outputSchema = z
  .object({
    directory: z.string().default("./snapshots"),
    fullPage: z.boolean().default(true),
    structure: z.enum(["flat", "run", "scope"]).default("flat"),
  })
  .default({});

/** Validated `output` section, inferred from {@link outputSchema}. */
export type OutputConfig = z.infer<typeof outputSchema>;
