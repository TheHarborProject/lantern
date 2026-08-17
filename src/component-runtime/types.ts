import type { Browser, Page } from "playwright";

/** A component the runtime should mount, as located by the component scan. */
export interface IsolationComponentTarget {
  readonly name: string;
  /** Absolute path to the component source module. */
  readonly sourcePath: string;
  /** `"default"` or a named export. */
  readonly exportName: string;
}

/** Resolved project-level globals injected into every isolation page. */
export interface IsolationGlobals {
  /** Absolute paths to global stylesheets. */
  readonly globalCssPaths: readonly string[];
  /** Absolute path to a shared wrapper/provider module, if configured. */
  readonly wrapperModulePath?: string | undefined;
  /** Export of the wrapper module to use (defaults to `"default"`). */
  readonly wrapperExport?: string | undefined;
}

export interface BundleInput {
  /** Absolute path to the generated harness entry module. */
  readonly entryPath: string;
  /** Project root used to resolve the component's dependencies (React, …). */
  readonly projectRoot: string;
}

/** Turns the generated harness entry into browser-ready JavaScript. */
export type ComponentBundler = (input: BundleInput) => Promise<string>;

/** Handle exposed to audit engines once a component is mounted. */
export interface IsolatedRender {
  readonly page: Page;
}

export interface RenderComponentOptions {
  readonly projectRoot: string;
  readonly target: IsolationComponentTarget;
  /** Data supplied by the audit; never invented by the runtime. */
  readonly props?: Record<string, unknown> | undefined;
  readonly globals?: IsolationGlobals | undefined;
  readonly mountTimeoutMs?: number | undefined;
  /** Injected bundler; defaults to the esbuild-backed implementation. */
  readonly bundle?: ComponentBundler | undefined;
  /** Injected browser launcher; defaults to headless Chromium. */
  readonly launch?: (() => Promise<Browser>) | undefined;
}

export interface ComponentRuntimeSessionOptions {
  readonly projectRoot: string;
  readonly globals?: IsolationGlobals | undefined;
  readonly mountTimeoutMs?: number | undefined;
  readonly bundle?: ComponentBundler | undefined;
  readonly launch?: (() => Promise<Browser>) | undefined;
}

export interface ComponentRuntime {
  render<T>(props: Record<string, unknown>, use: (render: IsolatedRender) => Promise<T>): Promise<T>;
}

export interface LintExecutionSession {
  componentRuntime(target: IsolationComponentTarget): Promise<ComponentRuntime>;
  close(): Promise<void>;
}
