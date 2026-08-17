import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findSourceFiles } from "./find-source-files.js";

function writeSource(root: string, path: string): void {
  const filePath = join(root, path);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, "export const X = () => null;");
}

describe("findSourceFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-find-source-files-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("finds every source file when no ignore patterns are configured", () => {
    writeSource(root, "src/Button.tsx");
    writeSource(root, "src/internal/Debug.tsx");

    expect(findSourceFiles(root)).toEqual([
      join(root, "src", "Button.tsx"),
      join(root, "src", "internal", "Debug.tsx"),
    ]);
  });

  it("excludes files matching a configured ignore pattern", () => {
    writeSource(root, "src/Button.tsx");
    writeSource(root, "src/internal/Debug.tsx");

    expect(findSourceFiles(root, ["src/internal/**"])).toEqual([join(root, "src", "Button.tsx")]);
  });

  it("excludes a whole directory matched by a trailing-slash pattern", () => {
    writeSource(root, "src/Button.tsx");
    writeSource(root, "generated/Widget.tsx");

    expect(findSourceFiles(root, ["generated/"])).toEqual([join(root, "src", "Button.tsx")]);
  });

  it("keeps .lantern excluded regardless of configured ignorePatterns", () => {
    writeSource(root, "src/Button.tsx");
    writeSource(root, ".lantern/Old.tsx");

    expect(findSourceFiles(root, ["coverage/"])).toEqual([join(root, "src", "Button.tsx")]);
  });

  it("limits discovery to a configured source directory while keeping ignores project-relative", () => {
    writeSource(root, "src/Button.tsx");
    writeSource(root, "src/generated/Generated.tsx");
    writeSource(root, "outside/Widget.tsx");

    expect(findSourceFiles(root, ["src/generated/**"], join(root, "src"))).toEqual([
      join(root, "src", "Button.tsx"),
    ]);
  });
});
