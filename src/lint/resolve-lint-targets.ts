import { relative, sep } from "node:path";
import { readComponentScanCache } from "../component-scan/read-component-scan-cache.js";
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
import { getChangedFilesSince } from "./git-diff.js";
import type { LintTargetMode } from "./types.js";

export interface LintTargetSelection {
  readonly model: CanonicalComponentModel;
  readonly rescanned: boolean;
  /** `undefined` means every discovered component is targeted (incremental/`--all`). */
  readonly targetComponentIds: ReadonlySet<string> | undefined;
}

export interface ResolveLintTargetsOptions {
  readonly root: string;
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
  const { root, ignorePatterns, mode } = options;

  const { model, rescanned } =
    mode.kind === "all" ? forceRescan(root, ignorePatterns) : incrementalScan(root, ignorePatterns);

  const targetComponentIds =
    mode.kind === "since" ? computeSinceTargets(model, mode.ref, root, ignorePatterns) : undefined;

  return { model, rescanned, targetComponentIds };
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
  const detection = detectChangedSourceFiles(currentHashes, readScanStateCache(root));

  if (!detection.changed) {
    const cached = readComponentScanCache(root);
    if (cached !== undefined) {
      return { model: cached, rescanned: false };
    }
    // The hash cache says "unchanged" but the model cache is missing/corrupt:
    // recover safely by rescanning rather than trusting a partial cache state.
  }

  const model = rescanAndPersist(root, ignorePatterns);
  writeScanStateCache(root, { version: 1, sourceHashes: currentHashes });
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
): ReadonlySet<string> | undefined {
  const changedFiles = getChangedFilesSince(ref, root);
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
    if (!discoverableSourceFiles.has(changedFile)) {
      continue;
    }
    const declaredComponentIds = componentIdsByDeclaringFile.get(changedFile);
    if (declaredComponentIds === undefined) {
      // A changed file Lantern would scan, but that declares no component of
      // its own: cannot prove it is safe to exclude everything else.
      return undefined;
    }
    for (const componentId of declaredComponentIds) {
      targetComponentIds.add(componentId);
    }
  }

  return targetComponentIds;
}

function toPortablePath(path: string): string {
  return path.split(sep).join("/");
}
