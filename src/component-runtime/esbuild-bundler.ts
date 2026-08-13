import { build } from "esbuild";
import { ComponentRenderError } from "../errors/component-render-error.js";
import type { BundleInput, ComponentBundler } from "./types.js";

/**
 * Default bundler: esbuild transpiles and bundles the harness entry (and the
 * component + React, resolved from the project) into a single browser IIFE.
 *
 * Resolution and syntax errors are surfaced as {@link ComponentRenderError} with
 * esbuild's own message, which names the missing module or bad import so the
 * failure is actionable.
 */
export function createEsbuildBundler(): ComponentBundler {
  return async ({ entryPath, projectRoot }: BundleInput): Promise<string> => {
    try {
      const result = await build({
        entryPoints: [entryPath],
        absWorkingDir: projectRoot,
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        jsx: "automatic",
        logLevel: "silent",
        loader: { ".js": "jsx", ".jsx": "jsx", ".ts": "tsx", ".tsx": "tsx" },
      });
      const output = result.outputFiles?.[0]?.text;
      if (output === undefined) {
        throw new ComponentRenderError("Component bundling produced no output.");
      }
      return output;
    } catch (cause) {
      if (cause instanceof ComponentRenderError) {
        throw cause;
      }
      throw new ComponentRenderError(
        `Could not bundle the component for isolation. ${summarizeBundleError(cause)}`,
        { cause },
      );
    }
  };
}

function summarizeBundleError(cause: unknown): string {
  const errors = (cause as { errors?: readonly { text?: string }[] }).errors;
  if (errors !== undefined && errors.length > 0) {
    const text = errors.map((error) => error.text ?? "").filter((value) => value !== "").join("; ");
    if (text !== "") {
      return text;
    }
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}
