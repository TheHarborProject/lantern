import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashSourceFiles } from "./hash-source-files.js";

describe("hashSourceFiles", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-hash-source-files-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("hashes each file keyed by its portable, project-relative path", () => {
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "Button.tsx"), "export const Button = () => null;");

    const hashes = hashSourceFiles(root, [join(root, "src", "Button.tsx")]);

    expect(Object.keys(hashes)).toEqual(["src/Button.tsx"]);
    expect(hashes["src/Button.tsx"]).toBe(
      "ee213c4e256f360b460a8d7d25d7cadd69ad4bc48e41145b788326dae07930ed",
    );
  });

  it("is deterministic for the same content", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => null;");

    const first = hashSourceFiles(root, [join(root, "Button.tsx")]);
    const second = hashSourceFiles(root, [join(root, "Button.tsx")]);

    expect(first).toEqual(second);
  });

  it("changes when file content changes", () => {
    const filePath = join(root, "Button.tsx");
    writeFileSync(filePath, "export const Button = () => null;");
    const before = hashSourceFiles(root, [filePath]);

    writeFileSync(filePath, "export const Button = () => <button />;");
    const after = hashSourceFiles(root, [filePath]);

    expect(before["Button.tsx"]).not.toBe(after["Button.tsx"]);
  });
});
