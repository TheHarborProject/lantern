import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CanonicalComponent, CanonicalComponentModel } from "../types/component-scan.js";
import { applySurveyScanPolicy, computeScanDelta, inspectScanState, scanProject } from "./scan-service.js";

const component = (id: string, name = id): CanonicalComponent => ({
  id, source: `${name}.tsx`, exportName: name, name, exportKind: "named" as const, props: [],
  rendering: { intrinsicElements: ["button"], analyzable: true }, analysis: { status: "complete" as const, diagnostics: [] },
});

describe("RFC-010 scan service", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

  it("computes deterministic new, changed, unchanged, and removed IDs", () => {
    const before: CanonicalComponentModel = { version: 2, components: [component("z"), component("b", "Before"), component("gone")], diagnostics: [] };
    const after: CanonicalComponentModel = { version: 2, components: [component("b", "After"), component("a"), component("z")], diagnostics: [] };
    expect(computeScanDelta(before, after)).toEqual({ new: ["a"], changed: ["b"], unchanged: ["z"], removed: ["gone"] });
  });

  it("distinguishes missing, fresh, stale, and refresh policy behavior", () => {
    const root = mkdtempSync(join(tmpdir(), "lantern-rfc010-scan-")); roots.push(root);
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { jsx: "react-jsx" } }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const options = { root, sourceDirectory: root, ignorePatterns: [] as readonly string[] };
    expect(inspectScanState(options).kind).toBe("missing");
    const first = scanProject(options);
    expect(first.delta.new).toEqual(["Button.tsx#Button"]);
    expect(inspectScanState(options).kind).toBe("fresh");
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button disabled />;");
    const stale = inspectScanState(options);
    expect(stale.kind).toBe("stale");
    const current = applySurveyScanPolicy(stale, { ...options, policy: "current" });
    expect(current).toMatchObject({ wasStale: true, refreshed: false });
    expect(() => applySurveyScanPolicy(stale, { ...options, policy: "error" })).toThrow(/policy "error"/);
    expect(applySurveyScanPolicy(stale, { ...options, policy: "refresh" })).toMatchObject({ wasStale: true, refreshed: true });
  });
});
