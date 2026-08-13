import { z } from "zod";
import { computeParameterDiscrepancies } from "../domain/routes/compute-parameter-discrepancies.js";

/**
 * Route whose path contains dynamic segments (`[param]`).
 *
 * The structural consistency between `path` and `parameters` is always
 * validated during parsing, whether `snapshotPath` is provided or not
 * (RFC-004, review follow-up): `snapshotPath` only overrides the final URL
 * that gets visited and never bypasses model validation.
 */
export const dynamicRouteSchema = z
  .object({
    id: z.string(),
    path: z.string(),
    isDynamic: z.literal(true),
    parameters: z.record(z.string(), z.string()),
    enableSnapshot: z.boolean(),
    user: z.string().optional(),
    scope: z.string().optional(),
    /** Override only the final visited URL when provided (RFC-004). */
    snapshotPath: z.string().optional(),
  })
  .strict()
  .superRefine((route, ctx) => {
    const { missing, unknown } = computeParameterDiscrepancies(route.path, route.parameters);

    for (const name of missing) {
      ctx.addIssue({
        code: "custom",
        message: `Missing dynamic route parameter: ${name}`,
        path: ["parameters", name],
      });
    }

    for (const name of unknown) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown dynamic route parameter: ${name}`,
        path: ["parameters", name],
      });
    }
  });

/** Fixed-path route: `isDynamic` is omitted or explicitly `false`. */
export const staticRouteSchema = z
  .object({
    id: z.string(),
    path: z.string(),
    isDynamic: z.literal(false).optional(),
    enableSnapshot: z.boolean(),
    user: z.string().optional(),
    scope: z.string().optional(),
    /** Takes precedence over `path` when provided (RFC-004). */
    snapshotPath: z.string().optional(),
  })
  .strict();

export const routeSchema = z.union([dynamicRouteSchema, staticRouteSchema]);

/**
 * Route list: each entry is validated by {@link routeSchema}, and route ids
 * (`id`) must be unique across the list (RFC-004 acceptance criterion).
 */
export const routesSchema = z.array(routeSchema).superRefine((routes, ctx) => {
  const seenIds = new Set<string>();

  routes.forEach((route, index) => {
    if (seenIds.has(route.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate route id: ${route.id}`,
        path: [index, "id"],
      });
    }

    seenIds.add(route.id);
  });
});
