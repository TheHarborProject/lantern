import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { ComponentRenderError } from "../errors/component-render-error.js";
import { createEsbuildBundler } from "./esbuild-bundler.js";
import { generateHarnessDocument } from "./generate-harness-document.js";
import { generateHarnessEntry } from "./generate-harness-entry.js";
import type {
  ComponentRuntime,
  ComponentRuntimeSessionOptions,
  IsolatedRender,
  IsolationComponentTarget,
  LintExecutionSession,
} from "./types.js";

const DEFAULT_MOUNT_TIMEOUT_MS = 10_000;

export function createLintExecutionSession(
  options: ComponentRuntimeSessionOptions,
): LintExecutionSession {
  let browser: Browser | undefined;
  const runtimes = new Map<string, ComponentRuntime>();

  return {
    async componentRuntime(target): Promise<ComponentRuntime> {
      const key = JSON.stringify({ target, globals: options.globals });
      const cached = runtimes.get(key);
      if (cached !== undefined) {
        return cached;
      }
      validateRuntimeInputs(target, options);
      browser ??= await (options.launch ?? ((): Promise<Browser> => chromium.launch()))();
      const runtime = await createComponentRuntime(browser, target, options);
      runtimes.set(key, runtime);
      return runtime;
    },
    async close(): Promise<void> {
      await browser?.close();
    },
  };
}

async function createComponentRuntime(
  browser: Browser,
  target: IsolationComponentTarget,
  options: ComponentRuntimeSessionOptions,
): Promise<ComponentRuntime> {
  const styleContents = (options.globals?.globalCssPaths ?? []).map((cssPath) => readFileSync(cssPath, "utf-8"));
  const entrySource = generateHarnessEntry({
    componentImportPath: target.sourcePath,
    exportName: target.exportName,
    wrapperImportPath: options.globals?.wrapperModulePath,
    wrapperExport: options.globals?.wrapperExport,
  });

  const tempDir = mkdtempSync(join(tmpdir(), "lantern-isolation-"));
  const entryPath = join(tempDir, "lantern-entry.tsx");
  try {
    writeFileSync(entryPath, entrySource, "utf-8");
    const bundle = options.bundle ?? createEsbuildBundler();
    const script = await bundle({ entryPath, projectRoot: options.projectRoot });
    const document = generateHarnessDocument(styleContents);
    const timeout = options.mountTimeoutMs ?? DEFAULT_MOUNT_TIMEOUT_MS;
    rmSync(tempDir, { recursive: true, force: true });

    return {
      async render<T>(props: Record<string, unknown>, use: (render: IsolatedRender) => Promise<T>): Promise<T> {
        const page = await browser.newPage();
        try {
          await page.setContent(document, { waitUntil: "load" });
          await page.evaluate((nextProps) => {
            (globalThis as unknown as { __lanternProps__?: Record<string, unknown> }).__lanternProps__ = nextProps;
          }, props);
          await page.addScriptTag({ content: script });
          await waitForMount(page, timeout, target.name);
          return await use({ page });
        } finally {
          await page.close();
        }
      },
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function validateRuntimeInputs(target: IsolationComponentTarget, options: ComponentRuntimeSessionOptions): void {
  if (!existsSync(target.sourcePath)) {
    throw new ComponentRenderError(`Component source not found: ${target.sourcePath}`);
  }
  for (const cssPath of options.globals?.globalCssPaths ?? []) {
    if (!existsSync(cssPath)) {
      throw new ComponentRenderError(`Configured global stylesheet not found: ${cssPath}`);
    }
  }
  if (options.globals?.wrapperModulePath !== undefined && !existsSync(options.globals.wrapperModulePath)) {
    throw new ComponentRenderError(`Configured isolation wrapper not found: ${options.globals.wrapperModulePath}`);
  }
}

async function waitForMount(page: Page, timeout: number, name: string): Promise<void> {
  try {
    await page.waitForFunction(
      "Boolean(window.__lanternMounted__) || typeof window.__lanternError__ === 'string'",
      undefined,
      { timeout },
    );
  } catch (cause) {
    throw new ComponentRenderError(
      `Component "${name}" did not mount within ${timeout}ms. Check its required props, providers, or global styles.`,
      { cause },
    );
  }

  const renderError = await page.evaluate<string | null>(
    "typeof window.__lanternError__ === 'string' ? window.__lanternError__ : null",
  );
  if (renderError !== null) {
    throw new ComponentRenderError(`Component "${name}" failed to render: ${renderError}`);
  }
}
