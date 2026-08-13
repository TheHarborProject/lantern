import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { withBrowser } from "../browser/with-browser.js";
import { ComponentRenderError } from "../errors/component-render-error.js";
import { createEsbuildBundler } from "./esbuild-bundler.js";
import { generateHarnessDocument } from "./generate-harness-document.js";
import { generateHarnessEntry } from "./generate-harness-entry.js";
import type { IsolatedRender, RenderComponentOptions } from "./types.js";

const DEFAULT_MOUNT_TIMEOUT_MS = 10_000;

/**
 * Mount a single component in a temporary, Lantern-controlled isolation runtime
 * and hand the rendered page to `use` (typically an audit engine). No companion
 * file is written into the project: the generated harness lives in a temp
 * directory that is always removed afterwards.
 *
 * @throws {ComponentRenderError} The source is missing, a configured global is
 * missing, bundling fails, or the component does not render — each with a
 * message describing what is missing.
 */
export async function renderComponentInIsolation<T>(
  options: RenderComponentOptions,
  use: (render: IsolatedRender) => Promise<T>,
): Promise<T> {
  const { target, globals } = options;
  if (!existsSync(target.sourcePath)) {
    throw new ComponentRenderError(`Component source not found: ${target.sourcePath}`);
  }

  const styleContents = (globals?.globalCssPaths ?? []).map((cssPath) => {
    if (!existsSync(cssPath)) {
      throw new ComponentRenderError(`Configured global stylesheet not found: ${cssPath}`);
    }
    return readFileSync(cssPath, "utf-8");
  });

  if (globals?.wrapperModulePath !== undefined && !existsSync(globals.wrapperModulePath)) {
    throw new ComponentRenderError(`Configured isolation wrapper not found: ${globals.wrapperModulePath}`);
  }

  const entrySource = generateHarnessEntry({
    componentImportPath: target.sourcePath,
    exportName: target.exportName,
    props: options.props ?? {},
    wrapperImportPath: globals?.wrapperModulePath,
    wrapperExport: globals?.wrapperExport,
  });

  const tempDir = mkdtempSync(join(tmpdir(), "lantern-isolation-"));
  const entryPath = join(tempDir, "lantern-entry.tsx");
  try {
    writeFileSync(entryPath, entrySource, "utf-8");
    const bundle = options.bundle ?? createEsbuildBundler();
    const script = await bundle({ entryPath, projectRoot: options.projectRoot });
    const document = generateHarnessDocument(styleContents);
    const timeout = options.mountTimeoutMs ?? DEFAULT_MOUNT_TIMEOUT_MS;

    return await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setContent(document, { waitUntil: "load" });
      await page.addScriptTag({ content: script });
      await waitForMount(page, timeout, target.name);
      return await use({ page });
    }, options.launch !== undefined ? { launch: options.launch } : {});
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
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
