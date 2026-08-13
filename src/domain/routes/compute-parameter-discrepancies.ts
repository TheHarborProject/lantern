import { extractPathParameterNames } from "./extract-path-parameter-names.js";

export interface ParameterDiscrepancies {
  /** Names referenced in `path` but missing from `parameters`. */
  readonly missing: readonly string[];
  /** Keys from `parameters` that are not referenced in `path`. */
  readonly unknown: readonly string[];
}

/**
 * Compare the parameters declared in `path` (`[name]` segments) with the
 * ones provided in `parameters`. This shared logic is used by both Zod
 * validation (`src/schemas/route.ts`) and path resolution (RFC-004): the
 * structural consistency rules are identical whether `snapshotPath` is
 * provided or not.
 */
export function computeParameterDiscrepancies(
  path: string,
  parameters: Readonly<Record<string, string>>,
): ParameterDiscrepancies {
  const pathParameterNames = extractPathParameterNames(path);

  const missing = pathParameterNames.filter((name) => parameters[name] === undefined);
  const unknown = Object.keys(parameters).filter((name) => !pathParameterNames.includes(name));

  return { missing, unknown };
}
