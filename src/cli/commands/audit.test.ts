import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AccessibilityIndex,
  CanonicalComponentModel,
  ComponentScanIndex,
} from "../../types/component-scan.js";
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

  it("writes concise human, exhaustive internal, and accessibility projections", async () => {
    writeFileSync(join(root, "lantern.config.json"), JSON.stringify({ project: {} }));
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = Partial<Pick<HTMLButtonElement, "disabled" | "title">> & {
          variant?: "default" | "ghost";
        };
        export const Button = ({ variant }: ButtonProps) => <button className={variant} />;
      `,
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const program = createProgram();
    program.exitOverride();

    await program.parseAsync(["audit", "scan"], { from: "user" });

    const human = JSON.parse(
      readFileSync(join(root, ".lantern", "scan.json"), "utf-8"),
    ) as ComponentScanIndex;
    const cache = JSON.parse(
      readFileSync(join(root, ".lantern", "cache", "component-scan.json"), "utf-8"),
    ) as CanonicalComponentModel;
    const accessibility = JSON.parse(
      readFileSync(join(root, ".lantern", "accessibility.json"), "utf-8"),
    ) as AccessibilityIndex;

    // Human view is concise: only the component-owned prop.
    expect(human.components[0]?.id).toBe("Button.tsx#Button");
    expect(human.components[0]?.props.map((prop) => prop.name)).toEqual(["variant"]);

    // Internal model keeps the exhaustive inherited DOM prop surface.
    const cacheProps = cache.components[0]?.props.map((prop) => prop.name) ?? [];
    expect(cacheProps).toContain("variant");
    expect(cacheProps).toContain("disabled");
    expect(cacheProps).toContain("title");

    // Accessibility projection is consumable without any concrete engine.
    expect(accessibility.components[0]).toMatchObject({
      name: "Button",
      semantics: { nativeElements: ["button"], derived: true },
      interactivity: { focusable: true },
      runtimeAnalysisRequired: false,
    });

    expect(log).toHaveBeenCalledWith(expect.stringContaining("Discovered 1 components"));
    expect(existsSync(join(root, "Button.audit.json"))).toBe(false);
  });
});
