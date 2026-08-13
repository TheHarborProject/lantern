import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ComponentScanIndex } from "../types/component-scan.js";
import { SCAN_INDEX_PATH, writeScanIndex } from "./write-scan-index.js";

describe("writeScanIndex", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-scan-index-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes a stable regenerable index under .lantern", () => {
    const index: ComponentScanIndex = { version: 1, components: [], diagnostics: [] };

    const filePath = writeScanIndex(root, index);
    const firstContent = readFileSync(filePath, "utf-8");
    writeScanIndex(root, index);

    expect(filePath).toBe(join(root, SCAN_INDEX_PATH));
    expect(JSON.parse(firstContent)).toEqual(index);
    expect(readFileSync(filePath, "utf-8")).toBe(firstContent);
    expect(existsSync(join(root, "scan.json"))).toBe(false);
  });
});
