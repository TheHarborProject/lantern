import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configSchema } from "../schemas/config.js";
import { resolveConfigPaths } from "../config/resolve-config-paths.js";
import type { ResolvedConfig } from "../types/config.js";
import { buildLintReport } from "./build-lint-report.js";

function resolvedConfig(root: string, overrides: Record<string, unknown> = {}): ResolvedConfig {
  const raw = configSchema.parse({ project: { root: "." }, ...overrides });
  return resolveConfigPaths(raw, join(root, "lantern.config.json"));
}

describe("buildLintReport", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-build-lint-report-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports a ready component with review status and no fabricated checks", () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );

    const report = buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    expect(report.standards).toHaveLength(1);
    const button = report.standards[0]?.components[0];
    expect(button?.component).toBe("Button");
    expect(button?.planStatus).toBe("ready");
    expect(button?.status).toBe("review");
    expect(button?.states.length).toBeGreaterThan(0);
    for (const state of button?.states ?? []) {
      expect(state.checks).toEqual([]);
      expect(state.status).toBe("review");
    }
  });

  it("reports an unresolved component as skipped with a truthful reason", () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    const avatar = report.standards[0]?.components[0];
    expect(avatar?.planStatus).toBe("unresolved");
    expect(avatar?.status).toBe("skipped");
    expect(avatar?.states).toEqual([]);
    expect(avatar?.unresolvedProps?.[0]?.name).toBe("user");
    expect(avatar?.reason).toContain("user");
  });

  it("reports an explicitly skipped component distinctly from unresolved", () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = buildLintReport({
      config: resolvedConfig(root, { components: { Avatar: { skip: true } } }),
      mode: { kind: "incremental" },
    });

    const avatar = report.standards[0]?.components[0];
    expect(avatar?.planStatus).toBe("skipped");
    expect(avatar?.status).toBe("skipped");
    expect(avatar?.reason).toContain("Explicitly skipped");
  });

  it("preserves truncation metadata from RFC-006 state planning", () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { a: "1" | "2" | "3"; b: "1" | "2" | "3" };
        export const Button = ({ a, b }: ButtonProps) => <button>{a}{b}</button>;
      `,
    );

    const report = buildLintReport({
      config: resolvedConfig(root),
      mode: { kind: "incremental" },
      maxStates: 3,
    });

    const button = report.standards[0]?.components[0];
    expect(button?.totalPossibleStates).toBe(9);
    expect(button?.states).toHaveLength(3);
    expect(button?.truncated).toBe(true);
  });

  it("keeps multiple configured standards as separate report contexts", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = buildLintReport({
      config: resolvedConfig(root, { standards: ["wcag22-aa", "rgaa4.1"] }),
      mode: { kind: "incremental" },
    });

    expect(report.standards.map((standard) => standard.standard)).toEqual(["wcag22-aa", "rgaa4.1"]);
    expect(report.standards[0]?.components).toHaveLength(1);
    expect(report.standards[1]?.components).toHaveLength(1);
    expect(report.standards[0]).not.toBe(report.standards[1]);
  });

  it("summarizes planning once across standards, never double-counting or favoring one standard", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = buildLintReport({
      config: resolvedConfig(root, { standards: ["wcag22-aa", "rgaa4.1", "wcag21-aa"] }),
      mode: { kind: "incremental" },
    });

    // Every standard reports the same two components (planning is
    // standard-independent today), so a naive per-standard sum would count
    // 3x — the summary must not.
    expect(report.summary.componentsReview).toBe(1);
    expect(report.summary.componentsSkipped).toBe(1);
    // The same underlying planning pass is reused verbatim per standard,
    // making the "not per-standard" property structurally explicit rather
    // than an implementation detail a reader has to trust.
    expect(report.standards[0]?.components).toBe(report.standards[1]?.components);
    expect(report.standards[1]?.components).toBe(report.standards[2]?.components);
  });

  it("produces deterministic state ordering across repeated runs", () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { variant: "a" | "b" | "c" };
        export const Button = ({ variant }: ButtonProps) => <button>{variant}</button>;
      `,
    );

    const first = buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });
    const second = buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    expect(first.standards[0]?.components[0]?.states.map((state) => state.stateId)).toEqual(
      second.standards[0]?.components[0]?.states.map((state) => state.stateId),
    );
  });

  it("records the targeting mode and rescan flag", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = buildLintReport({ config: resolvedConfig(root), mode: { kind: "all" } });

    expect(report.targeting).toEqual({ mode: { kind: "all" }, rescanned: true });
  });
});
