import { readEnvFile } from "./read-env-file.js";

/**
 * Merge environment files from the working directory:
 * `.env.local` overrides `.env` when they define the same key (RFC-003).
 */
export function loadFileEnv(workingDirectory: string): Record<string, string> {
  const dotEnv = readEnvFile(workingDirectory, ".env");
  const dotEnvLocal = readEnvFile(workingDirectory, ".env.local");

  return { ...dotEnv, ...dotEnvLocal };
}
