import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LintTargetingError } from "../errors/lint-targeting-error.js";
import { getChangedFilesSince } from "./git-diff.js";

function git(args: readonly string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function initRepo(root: string): void {
  git(["init", "-q"], root);
  git(["config", "user.name", "Lantern Test"], root);
  git(["config", "user.email", "test@lantern.dev"], root);
}

function commitAll(root: string, message: string): void {
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", message], root);
}

describe("getChangedFilesSince", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-git-diff-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("throws an actionable error outside a Git repository", () => {
    expect(() => getChangedFilesSince("main", root)).toThrow(LintTargetingError);
  });

  it("throws an actionable error for an unknown ref", () => {
    initRepo(root);
    writeFileSync(join(root, "a.tsx"), "export const A = () => null;");
    commitAll(root, "initial");

    expect(() => getChangedFilesSince("does-not-exist", root)).toThrow(LintTargetingError);
  });

  it("reports files committed since the ref", () => {
    initRepo(root);
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => null;");
    commitAll(root, "initial");
    git(["branch", "base"], root);

    writeFileSync(join(root, "Chip.tsx"), "export const Chip = () => null;");
    commitAll(root, "add Chip");

    expect(getChangedFilesSince("base", root)).toEqual(["Chip.tsx"]);
  });

  it("reports uncommitted tracked changes", () => {
    initRepo(root);
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => null;");
    commitAll(root, "initial");
    git(["branch", "base"], root);

    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    expect(getChangedFilesSince("base", root)).toEqual(["Button.tsx"]);
  });

  it("reports new untracked files", () => {
    initRepo(root);
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => null;");
    commitAll(root, "initial");
    git(["branch", "base"], root);

    writeFileSync(join(root, "Chip.tsx"), "export const Chip = () => null;");

    expect(getChangedFilesSince("base", root)).toEqual(["Chip.tsx"]);
  });

  it("reports nothing when there are no changes since the ref", () => {
    initRepo(root);
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => null;");
    commitAll(root, "initial");
    git(["branch", "base"], root);

    expect(getChangedFilesSince("base", root)).toEqual([]);
  });
});
