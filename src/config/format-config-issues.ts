import type { z } from "zod";

/**
 * Format a Zod validation error into a human-readable, path-preserving list
 * (RFC-013 §7) instead of exposing a raw Zod stack trace. Each issue becomes:
 *
 * ```text
 * auth.selectors.submit
 *   Expected string
 * ```
 *
 * The dotted path locates the invalid field; array indices are kept as
 * numeric segments (for example `routes.0.id`). Issues without a path are
 * reported under `(root)`.
 */
export function formatConfigIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}\n  ${issue.message}`;
    })
    .join("\n\n");
}
