import { resolve } from "node:path";
import type { IsolationConfig } from "../schemas/isolation.js";
import type { IsolationGlobals } from "./types.js";

/**
 * Turn the project-level `isolation` configuration (paths relative to the
 * project root) into absolute {@link IsolationGlobals} the runtime can inject.
 * Returns empty globals when the section is absent.
 */
export function resolveIsolationGlobals(
  projectRoot: string,
  isolation: IsolationConfig | undefined,
): IsolationGlobals {
  if (isolation === undefined) {
    return { globalCssPaths: [] };
  }

  return {
    globalCssPaths: isolation.globalCss.map((cssPath) => resolve(projectRoot, cssPath)),
    ...(isolation.wrapper !== undefined
      ? { wrapperModulePath: resolve(projectRoot, isolation.wrapper), wrapperExport: isolation.wrapperExport }
      : {}),
  };
}
