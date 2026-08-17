import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readComponentScanCache } from "../component-scan/read-component-scan-cache.js";
import { readScanStateCache } from "../component-scan/scan-state-cache.js";
import { resolveLintTargets } from "./resolve-lint-targets.js";

function writeButton(root: string): void {
  writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
}

function git(args: readonly string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

describe("resolveLintTargets", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-resolve-lint-targets-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("rescans and persists both caches when nothing is cached yet", () => {
    writeButton(root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    expect(result.rescanned).toBe(true);
    expect(result.model.components.map((component) => component.name)).toEqual(["Button"]);
    expect(result.targetComponentIds).toBeUndefined();
    expect(readComponentScanCache(root)?.components).toHaveLength(1);
    expect(readScanStateCache(root)?.sourceHashes["Button.tsx"]).toBeDefined();
  });

  it("reuses the cached model on a second incremental run when nothing changed", () => {
    writeButton(root);
    resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    const second = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    expect(second.rescanned).toBe(false);
    expect(second.model.components.map((component) => component.name)).toEqual(["Button"]);
  });

  it("rescans again once a source file changes", () => {
    writeButton(root);
    resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    writeFileSync(join(root, "Chip.tsx"), "export const Chip = () => <span />;");
    const second = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    expect(second.rescanned).toBe(true);
    expect(second.model.components.map((component) => component.name).sort()).toEqual(["Button", "Chip"]);
  });

  it("always rescans in --all mode even when the cache is fresh", () => {
    writeButton(root);
    resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "all" } });

    expect(result.rescanned).toBe(true);
    expect(result.targetComponentIds).toBeUndefined();
  });

  it("falls back to a full rescan when the model cache is missing despite an unchanged hash cache", () => {
    writeButton(root);
    resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });
    rmSync(join(root, ".lantern", "cache", "component-scan.json"));
    expect(existsSync(join(root, ".lantern", "cache", "component-scan.json"))).toBe(false);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "incremental" } });

    expect(result.rescanned).toBe(true);
    expect(result.model.components).toHaveLength(1);
  });

  it("narrows report scope to components changed since a Git ref in --since mode", () => {
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    writeButton(root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    writeFileSync(join(root, "Chip.tsx"), "export const Chip = () => <span />;");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "add Chip"], root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "since", ref: "base" } });

    const chip = result.model.components.find((component) => component.name === "Chip");
    const button = result.model.components.find((component) => component.name === "Button");
    expect(result.targetComponentIds).toEqual(new Set([chip?.id]));
    expect(result.targetComponentIds?.has(button?.id ?? "")).toBe(false);
  });

  it("falls back to the full component set when a changed shared dependency cannot be safely mapped", () => {
    // A shared, non-component source file (a plain util) that Button.tsx
    // depends on, without Lantern tracking that dependency edge.
    writeFileSync(join(root, "format-label.ts"), "export const formatLabel = (value: string) => value.toUpperCase();");
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "Chip.tsx"), "export const Chip = () => <span />;");
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    // Only the shared dependency changes — neither Button.tsx nor Chip.tsx do.
    writeFileSync(join(root, "format-label.ts"), "export const formatLabel = (value: string) => value.trim().toUpperCase();");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "change shared dependency"], root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "since", ref: "base" } });

    // Falling back to "target everything" (undefined) is the only way to
    // avoid silently omitting Button/Chip if format-label.ts actually affects
    // them — which resolveLintTargets cannot disprove without a dependency graph.
    expect(result.targetComponentIds).toBeUndefined();
    expect(result.model.components.map((component) => component.name).sort()).toEqual(["Button", "Chip"]);
  });

  it("falls back to the full component set when a changed barrel re-export file declares no component itself", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "index.ts"), "export { Button } from './Button.js';");
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    // Only the barrel file changes (e.g. a new re-export added) — Button.tsx does not.
    writeFileSync(join(root, "index.ts"), "export { Button } from './Button.js';\nexport const version = 2;");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "change barrel"], root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "since", ref: "base" } });

    expect(result.targetComponentIds).toBeUndefined();
  });

  it("does not fall back for a changed file outside Lantern's discovery surface", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "README.md"), "# demo");
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    // A non-source file changes; Button.tsx does not.
    writeFileSync(join(root, "README.md"), "# demo, updated");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "update readme"], root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "since", ref: "base" } });

    expect(result.targetComponentIds).toEqual(new Set());
  });

  it("does not fall back for a changed file inside an ignored directory", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    mkdirSync(join(root, "stories"), { recursive: true });
    writeFileSync(join(root, "stories", "notes.ts"), "export const note = 'wip';");
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    writeFileSync(join(root, "stories", "notes.ts"), "export const note = 'updated';");
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "update ignored file"], root);

    const result = resolveLintTargets({
      root,
      ignorePatterns: ["stories/"],
      mode: { kind: "since", ref: "base" },
    });

    expect(result.targetComponentIds).toEqual(new Set());
  });

  it("records a deleted source fallback reason for --since output", () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "format-label.ts"), "export const formatLabel = (value: string) => value;");
    git(["init", "-q"], root);
    git(["config", "user.name", "Lantern Test"], root);
    git(["config", "user.email", "test@lantern.dev"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "initial"], root);
    git(["branch", "base"], root);

    rmSync(join(root, "format-label.ts"));
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "delete shared source"], root);

    const result = resolveLintTargets({ root, ignorePatterns: [], mode: { kind: "since", ref: "base" } });

    expect(result.targetComponentIds).toBeUndefined();
    expect(result.selection).toEqual({ kind: "fallback", reason: "source deleted: format-label.ts" });
  });

  it("honors ignorePatterns during rescan", () => {
    writeButton(root);
    mkdirSync(join(root, "generated"), { recursive: true });
    writeFileSync(join(root, "generated", "Widget.tsx"), "export const Widget = () => <div />;");

    const result = resolveLintTargets({ root, ignorePatterns: ["generated/"], mode: { kind: "incremental" } });

    expect(result.model.components.map((component) => component.name)).toEqual(["Button"]);
  });

  it("targets all components sourced from an explicit file", () => {
    writeFileSync(join(root, "controls.tsx"), "export const TextInput = () => <input />; export const Select = () => <select />;");
    writeButton(root);

    const result = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "controls.tsx" } });

    const selected = result.model.components.filter((component) => result.targetComponentIds?.has(component.id));
    expect(selected.map((component) => component.name).sort()).toEqual(["Select", "TextInput"]);
    expect(result.selection).toEqual({ kind: "path", path: "controls.tsx", pathKind: "file", componentCount: 2 });
  });

  it("supports absolute file paths", () => {
    writeButton(root);

    const result = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: join(root, "Button.tsx") } });

    expect(result.targetComponentIds).toEqual(new Set(["Button.tsx#Button"]));
    expect(result.selection).toEqual({ kind: "path", path: "Button.tsx", pathKind: "file", componentCount: 1 });
  });

  it("targets components recursively under an explicit directory without prefix collisions", () => {
    mkdirSync(join(root, "src", "components", "ui", "nested"), { recursive: true });
    mkdirSync(join(root, "src", "components", "ui-old"), { recursive: true });
    writeFileSync(join(root, "src", "components", "ui", "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "src", "components", "ui", "nested", "Input.tsx"), "export const Input = () => <input />;");
    writeFileSync(join(root, "src", "components", "ui-old", "Legacy.tsx"), "export const Legacy = () => <button />;");

    const result = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "src/components/ui" } });

    const selected = result.model.components.filter((component) => result.targetComponentIds?.has(component.id));
    expect(selected.map((component) => component.name).sort()).toEqual(["Button", "Input"]);
    expect(result.selection).toEqual({ kind: "path", path: "src/components/ui", pathKind: "directory", componentCount: 2 });
  });

  it("supports dot and absolute directory paths", () => {
    writeButton(root);
    writeFileSync(join(root, "Card.tsx"), "export const Card = () => <article />;");

    const dot = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "." } });
    const absolute = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: root } });

    expect(dot.targetComponentIds).toEqual(new Set(["Button.tsx#Button", "Card.tsx#Card"]));
    expect(absolute.targetComponentIds).toEqual(dot.targetComponentIds);
    expect(dot.selection).toEqual({ kind: "path", path: ".", pathKind: "directory", componentCount: 2 });
  });

  it("returns an empty selection for existing files or directories without discovered components", () => {
    writeFileSync(join(root, "README.md"), "# docs");
    writeFileSync(join(root, "utils.ts"), "export const add = (left: number, right: number) => left + right;");
    mkdirSync(join(root, "empty"), { recursive: true });

    const readme = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "README.md" } });
    const utils = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "utils.ts" } });
    const empty = resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "empty" } });

    expect(readme.targetComponentIds).toEqual(new Set());
    expect(utils.targetComponentIds).toEqual(new Set());
    expect(empty.targetComponentIds).toEqual(new Set());
  });

  it("does not bypass ignore patterns for explicit directories", () => {
    mkdirSync(join(root, "src", "ignored"), { recursive: true });
    writeFileSync(join(root, "src", "Visible.tsx"), "export const Visible = () => <div />;");
    writeFileSync(join(root, "src", "ignored", "Hidden.tsx"), "export const Hidden = () => <div />;");

    const result = resolveLintTargets({ root, cwd: root, ignorePatterns: ["src/ignored/"], mode: { kind: "path", path: "src" } });

    const selected = result.model.components.filter((component) => result.targetComponentIds?.has(component.id));
    expect(selected.map((component) => component.name)).toEqual(["Visible"]);
  });

  it("fails clearly for nonexistent explicit paths", () => {
    expect(() =>
      resolveLintTargets({ root, cwd: root, ignorePatterns: [], mode: { kind: "path", path: "src/nope" } }),
    ).toThrow("Target path does not exist: src/nope");
  });
});
