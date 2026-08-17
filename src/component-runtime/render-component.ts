import { createLintExecutionSession } from "./runtime-session.js";
import type { IsolatedRender, RenderComponentOptions } from "./types.js";

/**
 * Backward-compatible single-render helper. New multi-state execution should
 * create a `LintExecutionSession` and reuse its per-component runtime instead.
 */
export async function renderComponentInIsolation<T>(
  options: RenderComponentOptions,
  use: (render: IsolatedRender) => Promise<T>,
): Promise<T> {
  const session = createLintExecutionSession({
    projectRoot: options.projectRoot,
    globals: options.globals,
    mountTimeoutMs: options.mountTimeoutMs,
    bundle: options.bundle,
    launch: options.launch,
  });
  try {
    const runtime = await session.componentRuntime(options.target);
    return await runtime.render(options.props ?? {}, use);
  } finally {
    await session.close();
  }
}
