export interface HarnessEntryInput {
  /** Path the bundler can resolve to the component module (absolute). */
  readonly componentImportPath: string;
  /** `"default"` or a named export. */
  readonly exportName: string;
  /** Props supplied by the audit; serialized verbatim, never invented. */
  readonly props: Record<string, unknown>;
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

  const wrappedExpression = hasWrapper
    ? "createElement(LanternWrapper, null, rendered)"
    : "rendered";

  return [
    `import { Component, createElement, StrictMode, useEffect } from "react";`,
    `import { createRoot } from "react-dom/client";`,
    componentSpecifier,
    wrapperSpecifier,
    ``,
    `const props = ${JSON.stringify(input.props)};`,
    ``,
    `function reportError(error) {`,
    `  const message = error && error.message ? error.message : String(error);`,
    `  if (!window.__lanternError__) {`,
    `    window.__lanternError__ = message;`,
    `  }`,
    `}`,
    ``,
    `class LanternBoundary extends Component {`,
    `  componentDidCatch(error) {`,
    `    reportError(error);`,
    `  }`,
    `  render() {`,
    `    return this.props.children;`,
    `  }`,
    `}`,
    ``,
    `function LanternReady() {`,
    `  useEffect(() => {`,
    `    window.__lanternMounted__ = true;`,
    `  }, []);`,
    `  return null;`,
    `}`,
    ``,
    `window.addEventListener("error", (event) => reportError(event.error || event.message));`,
    ``,
    `try {`,
    `  const container = document.getElementById("root");`,
    `  if (!container) {`,
    `    reportError("Lantern isolation root '#root' was not found.");`,
    `  } else {`,
    `    const rendered = createElement(LanternComponent, props);`,
    `    const tree = createElement(`,
    `      StrictMode,`,
    `      null,`,
    `      createElement(LanternBoundary, null, ${wrappedExpression}),`,
    `      createElement(LanternReady),`,
    `    );`,
    `    createRoot(container).render(tree);`,
    `  }`,
    `} catch (error) {`,
    `  reportError(error);`,
    `}`,
    ``,
  ].filter((line) => line !== "").join("\n").concat("\n");
}
