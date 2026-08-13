import type { z } from "zod";
import type { dynamicRouteSchema, routeSchema, staticRouteSchema } from "../schemas/route.js";

export type RawStaticRoute = z.infer<typeof staticRouteSchema>;
export type RawDynamicRoute = z.infer<typeof dynamicRouteSchema>;

/** Static or dynamic route as validated by the schema. */
export type RawRoute = z.infer<typeof routeSchema>;
