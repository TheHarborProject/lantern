import { z } from "zod";

/**
 * Shared settings extension point, analogous to ESLint `settings` (RFC-005).
 *
 * Its purpose is project/plugin/rule shared configuration that does not
 * naturally belong to a single rule. This RFC deliberately does not invent a
 * settings catalog: the representation is an open, keyed object so future RFCs
 * can populate it without a schema migration, while parsing stays strict
 * (values must live under string keys, not a bare primitive).
 */
export const settingsSchema = z.record(z.string(), z.unknown());

/** Validated `settings` section, inferred from {@link settingsSchema}. */
export type SettingsConfig = z.infer<typeof settingsSchema>;
