import { z } from "zod";

/**
 * `project` section (RFC-002). Only this section is required at the root.
 * Every field has a safe runtime default except `baseUrl` and `startScript`:
 * - `root` defaults to `"."`;
 * - `workingDirectory` defaults to `"."`, so it resolves from `root` when omitted;
 * - `autoStart` defaults to `false` so Lantern never starts a process implicitly;
 * - `baseUrl` and `startScript` stay optional during configuration loading:
 *   whether they are required depends on the command being executed
 *   whether they are required depends on the future audit command.
 */
export const projectSchema = z
  .object({
    root: z.string().default("."),
    workingDirectory: z.string().default("."),
    baseUrl: z.string().optional(),
    startScript: z.string().trim().min(1).optional(),
    // Keep the retired key in the input shape solely to reject it explicitly;
    // otherwise Zod's historical object behavior would silently strip it.
    startCommand: z.never().optional(),
    autoStart: z.boolean().default(false),
  })
  .transform(({ startCommand: _startCommand, ...project }) => project);

/** Validated `project` section, inferred from {@link projectSchema}. */
export type ProjectConfig = z.infer<typeof projectSchema>;
