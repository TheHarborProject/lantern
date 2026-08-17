import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLintExecutionSession } from "./runtime-session.js";

describe("createLintExecutionSession", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-runtime-session-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "Button.tsx"), "export const Button = () => null;");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("bundles once and reuses one browser for multiple state props", async () => {
    const { page, evaluate } = createFakePage();
    const newPage = vi.fn(() => Promise.resolve(page));
    const closeBrowser = vi.fn(() => Promise.resolve(undefined));
    const browser = {
      newPage,
      close: closeBrowser,
    } as unknown as Browser;
    const launch = vi.fn(() => Promise.resolve(browser));
    const bundle = vi.fn(() => Promise.resolve("window.__lanternMounted__ = true;"));
    const session = createLintExecutionSession({ projectRoot: root, launch, bundle });

    try {
      const runtime = await session.componentRuntime({
        name: "Button",
        sourcePath: join(root, "src", "Button.tsx"),
        exportName: "Button",
      });

      await runtime.render({ variant: "default" }, () => Promise.resolve("first"));
      await runtime.render({ variant: "outline" }, () => Promise.resolve("second"));
    } finally {
      await session.close();
    }

    expect(launch).toHaveBeenCalledTimes(1);
    expect(bundle).toHaveBeenCalledTimes(1);
    expect(newPage).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenNthCalledWith(1, expect.any(Function), { variant: "default" });
    expect(evaluate).toHaveBeenNthCalledWith(2, expect.any(String));
    expect(evaluate).toHaveBeenNthCalledWith(3, expect.any(Function), { variant: "outline" });
    expect(evaluate).toHaveBeenNthCalledWith(4, expect.any(String));
  });
});

function createFakePage(): { readonly page: Page; readonly evaluate: ReturnType<typeof vi.fn> } {
  const evaluate = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(undefined))
    .mockImplementationOnce(() => Promise.resolve(null))
    .mockImplementationOnce(() => Promise.resolve(undefined))
    .mockImplementationOnce(() => Promise.resolve(null));
  const page = {
    setContent: vi.fn(() => Promise.resolve(undefined)),
    evaluate,
    addScriptTag: vi.fn(() => Promise.resolve(null)),
    waitForFunction: vi.fn(() => Promise.resolve(null)),
    close: vi.fn(() => Promise.resolve(undefined)),
  } as unknown as Page;
  return { page, evaluate };
}
