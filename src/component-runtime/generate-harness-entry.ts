export interface HarnessEntryInput {
  /** Path the bundler can resolve to the component module (absolute). */
  readonly componentImportPath: string;
  /** `"default"` or a named export. */
  readonly exportName: string;
  /** @deprecated Props are now supplied at runtime through the harness window boundary. */
  readonly props?: Record<string, unknown> | undefined;
  /** Optional shared wrapper/provider module (absolute path). */
  readonly wrapperImportPath?: string | undefined;
  /** Export of the wrapper module to use (defaults to `"default"`). */
  readonly wrapperExport?: string | undefined;
}

/**
 * Generate the virtual harness entry module that mounts one component.
 *
 * The module imports the discovered component (and the shared wrapper, if any),
 * renders it into `#root`, and reports success (`window.__lanternMounted__`) or
 * an actionable failure (`window.__lanternError__`) so Playwright — and the
 * audit engines behind it — can observe the rendered DOM or learn what is
 * missing. It is never written into the project: the runtime materializes it in
 * a temporary directory it owns.
 */
export function generateHarnessEntry(input: HarnessEntryInput): string {
  const harnessPath = join(dirname(fileURLToPath(import.meta.url)), "templates", "harness.js");
  const componentSpecifier = input.exportName === "default"
    ? `import LanternComponent from ${JSON.stringify(input.componentImportPath)};`
    : `import { ${input.exportName} as LanternComponent } from ${JSON.stringify(input.componentImportPath)};`;

  const hasWrapper = input.wrapperImportPath !== undefined;
  const wrapperExport = input.wrapperExport ?? "default";
  const wrapperSpecifier = hasWrapper
    ? wrapperExport === "default"
      ? `import LanternWrapper from ${JSON.stringify(input.wrapperImportPath)};`
      : `import { ${wrapperExport} as LanternWrapper } from ${JSON.stringify(input.wrapperImportPath)};`
    : "";

  return [
    `import { mountLanternHarness } from ${JSON.stringify(harnessPath)};`,
    componentSpecifier,
    wrapperSpecifier,
    ``,
    hasWrapper
      ? `mountLanternHarness({ component: LanternComponent, wrapper: LanternWrapper });`
      : `mountLanternHarness({ component: LanternComponent });`,
    ``,
  ].filter((line) => line !== "").join("\n").concat("\n");
}
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
