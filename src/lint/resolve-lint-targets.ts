import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { matchesAnyGlob } from "../config/glob-match.js";
import { readComponentScanCache } from "../component-scan/read-component-scan-cache.js";
import { computeScanFingerprint } from "../component-scan/compute-scan-fingerprint.js";
import { runComponentScan } from "../component-scan/run-component-scan.js";
import { findSourceFiles } from "../component-scan/find-source-files.js";
import { hashSourceFiles } from "../component-scan/hash-source-files.js";
import { projectAccessibility } from "../component-scan/project-accessibility.js";
import { projectHumanScan } from "../component-scan/project-human-scan.js";
import { detectChangedSourceFiles, readScanStateCache, writeScanStateCache } from "../component-scan/scan-state-cache.js";
import { writeAccessibilityIndex } from "../component-scan/write-accessibility-index.js";
import { writeComponentScanCache } from "../component-scan/write-component-scan-cache.js";
import { writeScanIndex } from "../component-scan/write-scan-index.js";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import { LintTargetingError } from "../errors/lint-targeting-error.js";
import { getChangedFileDetailsSince } from "./git-diff.js";
import type { LintTargetMode, LintTargetSelectionInfo } from "./types.js";

export interface LintTargetSelection {
  readonly model: CanonicalComponentModel;
  readonly rescanned: boolean;
  /** `undefined` means every discovered component is targeted (incremental/`--all`). */
  readonly targetComponentIds: ReadonlySet<string> | undefined;
  readonly selection: LintTargetSelectionInfo;
}

export interface ResolveLintTargetsOptions {
  readonly root: string;
  readonly cwd?: string | undefined;
  readonly ignorePatterns: readonly string[];
  readonly mode: LintTargetMode;
}

/**
 * Resolve which components `lantern lint` should process (RFC-007), reusing
 * the single RFC-002/RFC-004 discovery implementation — there is no
 * lint-specific scanner.
 *
 * Scan refresh and report scope are independent concerns:
 * - `"all"` unconditionally rescans; `"incremental"`/`"since"` reuse the cached
 *   canonical model when a content-hash comparison proves nothing changed,
 *   and fall back to a full rescan on any ambiguity (missing/corrupt cache,
 *   added/removed/modified files) — correctness over narrow optimization.
 * - Report scope is the full discovered component set for `"incremental"`/`"all"`;
 *   only `"since"` narrows it, and only when every changed file can be safely
 *   proven to affect nothing beyond its own directly-declared components (see
 *   {@link computeSinceTargets}) — otherwise it falls back to the full set too.
 */
export function resolveLintTargets(options: ResolveLintTargetsOptions): LintTargetSelection {
  const { root, cwd = root, ignorePatterns, mode } = options;

  const { model, rescanned } =
    mode.kind === "all" ? forceRescan(root, ignorePatterns) : incrementalScan(root, ignorePatterns);

  const narrowedSelection =
    mode.kind === "since"
      ? computeSinceTargets(model, mode.ref, root, ignorePatterns)
      : mode.kind === "path"
        ? computePathTargets(model, mode.path, root, cwd)
        : undefined;
  const targetComponentIds = narrowedSelection?.targetComponentIds;
  const selection = narrowedSelection?.selection ?? { kind: "all" };

  return { model, rescanned, targetComponentIds, selection };
}

function computePathTargets(
  model: CanonicalComponentModel,
  inputPath: string,
  root: string,
  cwd: string,
): { readonly targetComponentIds: ReadonlySet<string>; readonly selection: LintTargetSelectionInfo } {
  const absoluteTarget = isAbsolute(inputPath) ? inputPath : resolve(cwd, inputPath);
  if (!existsSync(absoluteTarget)) {
    throw new LintTargetingError(`Target path does not exist: ${inputPath}`);
  }

  const stat = statSync(absoluteTarget);
  const pathKind = stat.isDirectory() ? "directory" : "file";
  const target = toPortablePath(relative(root, absoluteTarget));
  const targetComponentIds = new Set<string>();

  for (const component of model.components) {
    if (pathKind === "file" ? component.source === target : isDescendantOrSame(component.source, target)) {
      targetComponentIds.add(component.id);
    }
  }

  return {
    targetComponentIds,
    selection: { kind: "path", path: target === "" ? "." : target, pathKind, componentCount: targetComponentIds.size },
  };
}

function isDescendantOrSame(source: string, directory: string): boolean {
  if (directory === "") {
    return true;
  }
  const relativePath = relative(directory, source).split(sep).join("/");
  return relativePath !== "" && !relativePath.startsWith("..") && !relativePath.startsWith("/");
}

function forceRescan(root: string, ignorePatterns: readonly string[]): { model: CanonicalComponentModel; rescanned: boolean } {
  return { model: rescanAndPersist(root, ignorePatterns), rescanned: true };
}

function incrementalScan(
  root: string,
  ignorePatterns: readonly string[],
): { model: CanonicalComponentModel; rescanned: boolean } {
  const sourceFiles = findSourceFiles(root, ignorePatterns);
  const currentHashes = hashSourceFiles(root, sourceFiles);
  const currentFingerprint = computeScanFingerprint({ root, sourceHashes: currentHashes, ignorePatterns });
  const detection = detectChangedSourceFiles(currentHashes, currentFingerprint, readScanStateCache(root));

  if (!detection.changed) {
    const cached = readComponentScanCache(root);
    if (cached !== undefined) {
      return { model: cached, rescanned: false };
    }
    // The hash cache says "unchanged" but the model cache is missing/corrupt:
    // recover safely by rescanning rather than trusting a partial cache state.
  }

  const model = rescanAndPersist(root, ignorePatterns);
  writeScanStateCache(root, { version: 2, sourceHashes: currentHashes, fingerprint: currentFingerprint });
  return { model, rescanned: true };
}

function rescanAndPersist(root: string, ignorePatterns: readonly string[]): CanonicalComponentModel {
  const model = runComponentScan(root, ignorePatterns);
  writeComponentScanCache(root, model);
  writeScanIndex(root, projectHumanScan(model));
  writeAccessibilityIndex(root, projectAccessibility(model));
  return model;
}

/**
 * Narrow `--since` targeting to the components a changed file can *prove* it
 * affects, without building a dependency graph (RFC-007 explicitly rules that
 * out). The only provable relationship available is "this file directly
 * declares this component" (`CanonicalComponent.source`); anything else about
 * cross-file impact (a shared util/type/hook/barrel re-export, etc.) is
 * unknowable from the canonical model alone.
 *
 * So for each changed file:
 * - outside Lantern's discovery surface entirely (ignored, non-source,
 *   deleted) → provably irrelevant, skipped;
 * - directly declares one or more components → exactly those components are
 *   targeted;
 * - inside the discovery surface but declares no component (a shared
 *   dependency the scanner read but that produced no component of its own,
 *   or a barrel re-export) → its impact cannot be safely bounded, so target
 *   selection as a whole falls back to the full component set (`undefined`)
 *   rather than silently omitting whatever it affects.
 */
function computeSinceTargets(
  model: CanonicalComponentModel,
  ref: string,
  root: string,
  ignorePatterns: readonly string[],
): { readonly targetComponentIds: ReadonlySet<string> | undefined; readonly selection: LintTargetSelectionInfo } {
  const changedFiles = getChangedFileDetailsSince(ref, root);
  const discoverableSourceFiles = new Set(
    findSourceFiles(root, ignorePatterns).map((file) => toPortablePath(relative(root, file))),
  );

  const componentIdsByDeclaringFile = new Map<string, string[]>();
  for (const component of model.components) {
    const existing = componentIdsByDeclaringFile.get(component.source);
    if (existing === undefined) {
      componentIdsByDeclaringFile.set(component.source, [component.id]);
    } else {
      existing.push(component.id);
    }
  }

  const targetComponentIds = new Set<string>();
  for (const changedFile of changedFiles) {
    const pathsToConsider = [changedFile.path, changedFile.previousPath].filter((path): path is string => path !== undefined);
    if (
      (changedFile.kind === "deleted" || changedFile.kind === "renamed") &&
      pathsToConsider.some((path) => isPotentialDeletedDiscoverableSource(path, ignorePatterns))
    ) {
      const source = changedFile.previousPath ?? changedFile.path;
      return {
        targetComponentIds: undefined,
        selection: { kind: "fallback", reason: `source ${changedFile.kind}: ${source}` },
      };
    }
    const currentPath = changedFile.path;
    if (!discoverableSourceFiles.has(currentPath)) {
      continue;
    }
    const declaredComponentIds = componentIdsByDeclaringFile.get(currentPath);
    if (declaredComponentIds === undefined) {
      // A changed file Lantern would scan, but that declares no component of
      // its own: cannot prove it is safe to exclude everything else.
      return {
        targetComponentIds: undefined,
        selection: { kind: "fallback", reason: `shared source changed: ${currentPath}` },
      };
    }
    for (const componentId of declaredComponentIds) {
      targetComponentIds.add(componentId);
    }
  }

  return {
    targetComponentIds,
    selection:
      targetComponentIds.size === 0
        ? { kind: "none" }
        : { kind: "affected", componentCount: targetComponentIds.size },
  };
}

function isPotentialDeletedDiscoverableSource(path: string, ignorePatterns: readonly string[]): boolean {
  if (ignorePatterns.length > 0 && matchesAnyGlob(path, ignorePatterns)) {
    return false;
  }
  return (
    (path.endsWith(".ts") || path.endsWith(".tsx")) &&
    !path.endsWith(".d.ts") &&
    !path.endsWith(".test.ts") &&
    !path.endsWith(".test.tsx") &&
    !/(?:^|\.)config\.(?:c|m)?tsx?$/.test(path)
  );
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}
