import { interpolateValue } from "./interpolate-value.js";
import { loadFileEnv } from "./load-file-env.js";

export interface ResolveEnvValueOptions {
  /** Directory from which `.env.local` and `.env` are resolved (RFC-003). */
  readonly workingDirectory: string;
  /** Injectable for tests; defaults to `process.env`. */
  readonly processEnv?: NodeJS.ProcessEnv;
}

/**
 * Resolve a configuration value: a literal value (without `${...}`) is
 * returned as-is without reading the environment or disk
 * (priority 1 from RFC-003). Otherwise, each `${VARIABLE}` is resolved from
 * `process.env`, then `.env.local`, then `.env`.
 *
 * @throws {EnvVariableMissingError} If a referenced variable cannot be found.
 */
export function resolveEnvValue(rawValue: string, options: ResolveEnvValueOptions): string {
  if (!rawValue.includes("${")) {
    return rawValue;
  }

  const processEnv = options.processEnv ?? process.env;
  const fileEnv = loadFileEnv(options.workingDirectory);

  return interpolateValue(rawValue, { processEnv, fileEnv });
}
