import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ComponentRenderError } from "../errors/component-render-error.js";
import { createEsbuildBundler } from "./esbuild-bundler.js";

describe("createEsbuildBundler", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lantern-bundler-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("bundles a self-contained entry into browser JavaScript", async () => {
    const entryPath = join(dir, "entry.tsx");
    writeFileSync(entryPath, "const value = 1 + 1;\ndocument.title = String(value);\n");

    const output = await createEsbuildBundler()({ entryPath, projectRoot: dir });

    expect(output).toContain("document.title");
  });

  it("raises an actionable ComponentRenderError naming an unresolved dependency", async () => {
    const entryPath = join(dir, "entry.tsx");
    writeFileSync(entryPath, 'import { createRoot } from "react-dom/client";\ncreateRoot(document.body);\n');

    await expect(createEsbuildBundler()({ entryPath, projectRoot: dir })).rejects.toMatchObject({
      code: "COMPONENT_RENDER_FAILED",
    });
    await expect(createEsbuildBundler()({ entryPath, projectRoot: dir })).rejects.toThrow(/react-dom/);
    await expect(createEsbuildBundler()({ entryPath, projectRoot: dir })).rejects.toBeInstanceOf(
      ComponentRenderError,
    );
  });
});
