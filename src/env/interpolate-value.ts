import { EnvVariableMissingError } from "../errors/env-variable-missing-error.js";

const PLACEHOLDER_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface InterpolateContext {
  readonly processEnv: NodeJS.ProcessEnv;
  readonly fileEnv: Record<string, string>;
}

/**
 * Replace every `${VARIABLE}` placeholder in a string with its resolved
 * value. Supports multiple interpolations per string. Never executes code:
 * pure text substitution, no `eval`.
 *
 * @throws {EnvVariableMissingError} If a referenced variable cannot be found.
 */
export function interpolateValue(rawValue: string, context: InterpolateContext): string {
  return rawValue.replace(PLACEHOLDER_PATTERN, (_match, variableName: string) =>
    resolveVariable(variableName, context),
  );
}

function resolveVariable(name: string, context: InterpolateContext): string {
  const fromProcessEnv = context.processEnv[name];
  if (fromProcessEnv !== undefined) {
    return fromProcessEnv;
  }

  const fromFileEnv = context.fileEnv[name];
  if (fromFileEnv !== undefined) {
    return fromFileEnv;
  }

  throw new EnvVariableMissingError(name);
}
