import type { z } from "zod";
import type { configSchema } from "../schemas/config.js";

/**
 * Raw configuration: direct result of Zod validation.
 *
 * Schema defaults (for example `project.autoStart`, `output`, `routes`, and
 * `runs`) are already applied, but paths (`project.root`,
 * `project.workingDirectory`) stay relative exactly as written in the
 * configuration file.
 */
export type RawConfig = z.infer<typeof configSchema>;

/**
 * Resolved configuration: derived from {@link RawConfig} by replacing
 * `project.root` and `project.workingDirectory` with absolute paths
 * (RFC-002). Commands consume this form.
 */
export interface ResolvedConfig extends Omit<RawConfig, "project"> {
  readonly configFilePath: string;
  readonly project: Omit<RawConfig["project"], "root" | "workingDirectory"> & {
    readonly root: string;
    readonly workingDirectory: string;
  };
}
