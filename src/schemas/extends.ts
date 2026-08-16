import { z } from "zod";

/**
 * Reusable Lantern presets that `extends` may load (RFC-005).
 *
 * `extends` answers "which reusable Lantern configuration is loaded", distinct
 * from `standards` ("which accessibility reference is evaluated") and `rules`
 * ("the final project rule policy"). Presets are resolved deterministically, in
 * declared order, before the top-level project configuration.
 *
 * The catalog is intentionally small: this RFC establishes the schema and the
 * resolution boundary, not a plugin ecosystem. External presets can be added
 * later without changing the observable resolution semantics.
 */
export const KNOWN_PRESET_IDS = ["lantern:recommended"] as const;

const presetSchema = z.enum(KNOWN_PRESET_IDS);

/** The presets a project extends, resolved in declared order. */
export const extendsSchema = z.array(presetSchema);

/** A single validated preset identifier. */
export type PresetId = z.infer<typeof presetSchema>;

/** Validated `extends` section, inferred from {@link extendsSchema}. */
export type ExtendsConfig = z.infer<typeof extendsSchema>;
