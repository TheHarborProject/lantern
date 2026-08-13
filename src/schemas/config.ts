import { z } from "zod";
import { authSchema } from "./auth.js";
import { isolationSchema } from "./isolation.js";
import { projectSchema } from "./project.js";

/** Foundation configuration shared by future component-audit commands. */
export const configSchema = z.object({
  project: projectSchema,
  auth: authSchema.optional(),
  isolation: isolationSchema.optional(),
}).strict();

/** Validated Lantern configuration, inferred directly from {@link configSchema}. */
export type LanternConfig = z.infer<typeof configSchema>;
