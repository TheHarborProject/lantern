import { execFileSync } from "node:child_process";
import { relative, resolve as resolvePath, sep } from "node:path";
import { LintTargetingError } from "../errors/lint-targeting-error.js";

/**
 * Explicit Git-aware targeting for `lantern lint --since <ref>` (RFC-007).
 *
 * Determines every file that changed since `ref`, including committed changes
 * (via the merge-base with `HEAD`), uncommitted tracked changes, and new
 * untracked files — so a local `--since origin/main` run reflects what a
 * developer is actually about to submit, not just what is already committed.
 *
 * Using `--since` outside a Git repository, or with an unknown ref, is an
 * actionable CLI error rather than a silent fallback: this targeting mode is
 * explicit and opt-in, so ambiguity must surface, not be guessed away.
 */
export function getChangedFilesSince(ref: string, root: string): string[] {
  assertGitRepository(root);
  assertValidRef(ref, root);

  const mergeBase = tryGetMergeBase(ref, root) ?? ref;
  const changed = new Set([
    ...gitLines(["diff", "--name-only", mergeBase, "HEAD"], root),
    ...gitLines(["diff", "--name-only", "HEAD"], root),
    ...gitLines(["ls-files", "--others", "--exclude-standard"], root),
  ]);

  const repoRoot = git(["rev-parse", "--show-toplevel"], root).trim();

  return [...changed]
    .map((file) => toPortablePath(relative(root, resolvePath(repoRoot, file))))
    .filter((file) => !file.startsWith(".."));
}

function assertGitRepository(root: string): void {
  try {
    git(["rev-parse", "--is-inside-work-tree"], root);
  } catch (cause) {
    throw new LintTargetingError(
      `"--since" requires a Git repository, but no Git repository was found at ${root} (or Git is not installed).`,
      { cause },
    );
  }
}

function assertValidRef(ref: string, root: string): void {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], root);
  } catch (cause) {
    throw new LintTargetingError(
      `Unknown Git ref "${ref}". Check that it exists and is reachable from this repository.`,
      { cause },
    );
  }
}

function tryGetMergeBase(ref: string, root: string): string | undefined {
  try {
    return git(["merge-base", ref, "HEAD"], root).trim();
  } catch {
    return undefined;
  }
}

function gitLines(args: readonly string[], cwd: string): string[] {
  try {
    return git(args, cwd)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (cause) {
    throw new LintTargetingError(`Could not compute Git changes ("git ${args.join(" ")}").`, { cause });
  }
}

function git(args: readonly string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}
