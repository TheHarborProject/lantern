import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import { readComponentScanCache } from "./read-component-scan-cache.js";
import { writeComponentScanCache } from "./write-component-scan-cache.js";

describe("readComponentScanCache", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-read-component-scan-cache-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reads back a model written by writeComponentScanCache", () => {
    const model: CanonicalComponentModel = { version: 2, components: [], diagnostics: [] };
    writeComponentScanCache(root, model);

    expect(readComponentScanCache(root)).toEqual(model);
  });

  it("returns undefined when no cache exists", () => {
    expect(readComponentScanCache(root)).toBeUndefined();
  });

  it("returns undefined for malformed JSON instead of throwing", () => {
    mkdirSync(join(root, ".lantern", "cache"), { recursive: true });
    writeFileSync(join(root, ".lantern", "cache", "component-scan.json"), "{ not json");

    expect(readComponentScanCache(root)).toBeUndefined();
  });

  it("returns undefined for a structurally invalid cache instead of throwing", () => {
    mkdirSync(join(root, ".lantern", "cache"), { recursive: true });
    writeFileSync(join(root, ".lantern", "cache", "component-scan.json"), JSON.stringify({ foo: "bar" }));

    expect(readComponentScanCache(root)).toBeUndefined();
  });
});
