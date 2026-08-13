import { z } from "zod";
import { authSchema } from "./auth.js";
import { executionSchema } from "./execution.js";
import { outputSchema } from "./output.js";
import { projectSchema } from "./project.js";
import { routesSchema } from "./route.js";
import { runsSchema } from "./run.js";

/**
 * Root SnapRun configuration schema. Composes the modular domain schemas
 * (`project`, `output`, `auth`, `routes`, `runs`) so each domain owns its own
 * validity rules and runtime defaults:
 *
 * - `project` (`src/schemas/project.ts`) is the only required section (RFC-002);
 * - `output` (`src/schemas/output.ts`) is optional and defaults to `{}`;
 * - `auth` (`src/schemas/auth.ts`, RFC-007) stays optional;
 * - `routes` uses the complete model defined by RFC-004 (`src/schemas/route.ts`);
 * - `runs` uses the complete model defined by RFC-008 (`src/schemas/run.ts`);
 * - `execution` (`src/schemas/execution.ts`, RFC-014) is optional and defaults
 *   to `{ concurrency: 4 }`, so the resolved configuration always carries a
 *   usable concurrency value.
 *
 * Both `routes` and `runs` are optional and default to `[]`.
 */
export const configSchema = z.object({
  project: projectSchema,
  output: outputSchema,
  auth: authSchema.optional(),
  routes: routesSchema.default([]),
  runs: runsSchema.default([]),
  execution: executionSchema,
});

/** Validated SnapRun configuration, inferred directly from {@link configSchema}. */
export type SnaprunConfig = z.infer<typeof configSchema>;
