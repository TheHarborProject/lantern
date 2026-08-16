import { z } from "zod";

/**
 * Project-level ignore patterns affecting discovery/lint targeting (RFC-005).
 *
 * Patterns are matched against project-relative paths by the shared glob
 * matcher and layered on top of the component-discovery walker rather than a
 * second independent file walker. Generated `.lantern/` artifacts are always
 * excluded by the walker regardless of this list, so they never become
 * discovery candidates.
 */
export const ignorePatternsSchema = z.array(z.string());

/** Validated `ignorePatterns` section, inferred from {@link ignorePatternsSchema}. */
export type IgnorePatternsConfig = z.infer<typeof ignorePatternsSchema>;
