import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentScanIndex } from "../../types/component-scan.js";
import { createProgram } from "../program.js";

describe("lantern audit scan", () => {
  let root: string;
  const originalCwd = process.cwd();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-audit-scan-"));
    process.chdir(root);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("scans the configured project and creates only the internal index", async () => {
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {} }));
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["audit", "scan"], { from: "user" });

    const index = JSON.parse(
      readFileSync(join(root, ".lantern", "scan.json"), "utf-8"),
    ) as ComponentScanIndex;
    expect(index.components).toHaveLength(1);
    expect(index.components[0]?.id).toBe("Button.tsx#Button");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Discovered 1 components"));
    expect(existsSync(join(root, "Button.audit.json"))).toBe(false);
    expect(readFileSync(join(root, "Button.tsx"), "utf-8")).toContain("<button />");
  });
});
