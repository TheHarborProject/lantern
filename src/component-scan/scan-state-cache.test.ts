import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectChangedSourceFiles,
  readScanStateCache,
  writeScanStateCache,
} from "./scan-state-cache.js";

describe("scan state cache", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-scan-state-cache-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("round-trips through write and read", () => {
    writeScanStateCache(root, { version: 2, sourceHashes: { "Button.tsx": "abc" }, fingerprint: "fp" });

    expect(readScanStateCache(root)).toEqual({ version: 2, sourceHashes: { "Button.tsx": "abc" }, fingerprint: "fp" });
  });

  it("returns undefined when no cache exists", () => {
    expect(readScanStateCache(root)).toBeUndefined();
  });

  it("returns undefined for a structurally invalid cache instead of throwing", () => {
    mkdirSync(join(root, ".lantern", "cache"), { recursive: true });
    writeFileSync(join(root, ".lantern", "cache", "scan-state.json"), JSON.stringify({ version: 2 }));

    expect(readScanStateCache(root)).toBeUndefined();
  });

  it("returns undefined for malformed JSON instead of throwing", () => {
    mkdirSync(join(root, ".lantern", "cache"), { recursive: true });
    writeFileSync(join(root, ".lantern", "cache", "scan-state.json"), "{ not json");

    expect(readScanStateCache(root)).toBeUndefined();
  });
});

describe("detectChangedSourceFiles", () => {
  it("reports changed with no-previous-cache when there is nothing to compare against", () => {
    expect(detectChangedSourceFiles({ "Button.tsx": "abc" }, "fp", undefined)).toEqual({
      changed: true,
      reason: "no-previous-cache",
    });
  });

  it("reports unchanged when hashes are identical", () => {
    const previous = { version: 2 as const, sourceHashes: { "Button.tsx": "abc" }, fingerprint: "fp" };

    expect(detectChangedSourceFiles({ "Button.tsx": "abc" }, "fp", previous)).toEqual({
      changed: false,
      reason: "unchanged",
    });
  });

  it("reports changed when a hash differs", () => {
    const previous = { version: 2 as const, sourceHashes: { "Button.tsx": "abc" }, fingerprint: "fp" };

    expect(detectChangedSourceFiles({ "Button.tsx": "def" }, "fp", previous)).toEqual({
      changed: true,
      reason: "files-changed",
    });
  });

  it("reports changed when a file was added", () => {
    const previous = { version: 2 as const, sourceHashes: { "Button.tsx": "abc" }, fingerprint: "fp" };

    expect(detectChangedSourceFiles({ "Button.tsx": "abc", "Chip.tsx": "def" }, "fp", previous)).toEqual({
      changed: true,
      reason: "files-changed",
    });
  });

  it("reports changed when a file was removed", () => {
    const previous = {
      version: 2 as const,
      sourceHashes: { "Button.tsx": "abc", "Chip.tsx": "def" },
      fingerprint: "fp",
    };

    expect(detectChangedSourceFiles({ "Button.tsx": "abc" }, "fp", previous)).toEqual({
      changed: true,
      reason: "files-changed",
    });
  });
});
