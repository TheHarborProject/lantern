import { z } from "zod";

/**
 * Accessibility evaluation contexts a project requests (RFC-005).
 *
 * A standard describes *which* accessibility reference Lantern evaluates
 * against — it is neither an engine (an implementation capability) nor a preset
 * (a reusable configuration bundle). Several standards may be requested at once
 * and remain distinct evaluation contexts; Lantern never merges them into a
 * synthetic compliance standard.
 *
 * Selecting a standard does not imply Lantern can automatically prove every
 * criterion it defines. This RFC only defines configuration.
 */
export const KNOWN_STANDARDS = [
  "wcag21-a",
  "wcag21-aa",
  "wcag22-a",
  "wcag22-aa",
  "rgaa4.1",
] as const;

const standardSchema = z.enum(KNOWN_STANDARDS);

/**
 * The requested standards. Kept strict (a closed catalog) so typos surface as
 * actionable errors, and duplicate-free so each configured standard stays a
 * single distinct evaluation context.
 */
export const standardsSchema = z
  .array(standardSchema)
  .superRefine((standards, ctx) => {
    const seen = new Set<string>();
    standards.forEach((standard, index) => {
      if (seen.has(standard)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate standard "${standard}"; each standard must be listed once.`,
          path: [index],
        });
      }
      seen.add(standard);
    });
  });

/** A single validated standard identifier. */
export type Standard = z.infer<typeof standardSchema>;

/** Validated `standards` section, inferred from {@link standardsSchema}. */
export type StandardsConfig = z.infer<typeof standardsSchema>;
