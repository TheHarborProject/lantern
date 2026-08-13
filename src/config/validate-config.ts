import { configSchema } from "../schemas/config.js";
import { ConfigInvalidError } from "../errors/config-invalid-error.js";
import { formatConfigIssues } from "./format-config-issues.js";
import type { RawConfig } from "../types/config.js";

/** Validate raw configuration file data with Zod. */
export function validateConfig(data: unknown, filePath: string): RawConfig {
  const result = configSchema.safeParse(data);

  if (!result.success) {
    throw new ConfigInvalidError(
      `Invalid configuration: ${filePath}\n\n${formatConfigIssues(result.error)}`,
      { cause: result.error },
    );
  }

  return result.data;
}
