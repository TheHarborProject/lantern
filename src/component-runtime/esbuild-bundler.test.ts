import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("resolves a bare import from the project's node_modules even when the entry file lives outside projectRoot", async () => {
    // Mirrors `runtime-session.ts`: the harness entry is materialized in its
    // own temp directory (RFC-003/007.5), never inside `projectRoot` itself.
    const entryDir = mkdtempSync(join(tmpdir(), "lantern-bundler-entry-"));
    try {
      const packageDir = join(dir, "node_modules", "left-pad-stub");
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "left-pad-stub", main: "index.js" }));
      writeFileSync(join(packageDir, "index.js"), "export const stub = 42;\n");

      const entryPath = join(entryDir, "entry.tsx");
      writeFileSync(entryPath, 'import { stub } from "left-pad-stub";\ndocument.title = String(stub);\n');

      const output = await createEsbuildBundler()({ entryPath, projectRoot: dir });

      expect(output).toContain("42");
    } finally {
      rmSync(entryDir, { recursive: true, force: true });
    }
  });
});
