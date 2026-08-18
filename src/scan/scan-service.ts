import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeScanFingerprint } from "../component-scan/compute-scan-fingerprint.js";
import { findSourceFiles } from "../component-scan/find-source-files.js";
import { hashSourceFiles } from "../component-scan/hash-source-files.js";
import { projectAccessibility } from "../component-scan/project-accessibility.js";
import { projectHumanScan } from "../component-scan/project-human-scan.js";
import { readComponentScanCache } from "../component-scan/read-component-scan-cache.js";
import { runComponentScan } from "../component-scan/run-component-scan.js";
import { detectChangedSourceFiles, readScanStateCache, writeScanStateCache } from "../component-scan/scan-state-cache.js";
import { COMPONENT_SCAN_CACHE_PATH } from "../component-scan/artifact-paths.js";
import { writeAccessibilityIndex } from "../component-scan/write-accessibility-index.js";
import { writeComponentScanCache } from "../component-scan/write-component-scan-cache.js";
import { writeScanIndex } from "../component-scan/write-scan-index.js";
import { SurveyScanError } from "../errors/survey-scan-error.js";
import type { CanonicalComponent, CanonicalComponentModel } from "../types/component-scan.js";
import type { ApplyScanPolicyOptions, ResolvedSurveyScan, ScanDelta, ScanFreshness, ScanResult } from "./types.js";

interface CurrentInputs {
  readonly hashes: Readonly<Record<string, string>>;
  readonly fingerprint: string;
}

export function inspectScanState(options: Pick<ApplyScanPolicyOptions, "root" | "sourceDirectory" | "ignorePatterns">): ScanFreshness {
  const inputs = currentInputs(options);
  const modelPath = join(options.root, COMPONENT_SCAN_CACHE_PATH);
  const model = readComponentScanCache(options.root);
  if (model === undefined) {
    if (!existsSync(modelPath)) return { kind: "missing" };
    return { kind: "invalid", reason: classifyInvalidModel(modelPath) };
  }
  const previous = readScanStateCache(options.root);
  if (previous === undefined) return { kind: "invalid", reason: "corrupt" };
  const change = detectChangedSourceFiles(inputs.hashes, inputs.fingerprint, previous);
  if (!change.changed) return { kind: "fresh", model, fingerprint: inputs.fingerprint };
  return {
    kind: "stale",
    model,
    fingerprint: previous.fingerprint,
    reason: change.reason === "fingerprint-changed" ? "fingerprint-changed" : "files-changed",
  };
}

export function scanProject(
  options: Pick<ApplyScanPolicyOptions, "root" | "sourceDirectory" | "ignorePatterns"> & { readonly force?: boolean },
): ScanResult {
  const freshness = inspectScanState(options);
  if (freshness.kind === "fresh" && options.force !== true) {
    return {
      model: freshness.model,
      fingerprint: freshness.fingerprint,
      freshness: "fresh",
      refreshed: false,
      delta: unchangedDelta(freshness.model),
      diagnostics: [],
    };
  }
  const previous = freshness.kind === "fresh" || freshness.kind === "stale" ? freshness.model : undefined;
  const inputs = currentInputs(options);
  const model = runComponentScan(options.root, options.ignorePatterns, options.sourceDirectory);
  writeComponentScanCache(options.root, model);
  writeScanIndex(options.root, projectHumanScan(model));
  writeAccessibilityIndex(options.root, projectAccessibility(model));
  writeScanStateCache(options.root, { version: 2, sourceHashes: inputs.hashes, fingerprint: inputs.fingerprint });
  return {
    model,
    fingerprint: inputs.fingerprint,
    freshness: freshness.kind,
    refreshed: true,
    delta: computeScanDelta(previous, model),
    diagnostics: freshness.kind === "invalid" ? [`Previous scan was ${freshness.reason}; rebuilt from source.`] : [],
  };
}

export function applySurveyScanPolicy(freshness: ScanFreshness, options: ApplyScanPolicyOptions): ResolvedSurveyScan {
  if (freshness.kind === "fresh") {
    return { model: freshness.model, fingerprint: freshness.fingerprint, wasStale: false, refreshed: false, diagnostics: [] };
  }
  if (freshness.kind === "stale" && options.policy === "current") {
    return {
      model: freshness.model,
      fingerprint: freshness.fingerprint,
      wasStale: true,
      refreshed: false,
      diagnostics: [`Using a stale scan because survey.scan.nonInteractive is "current" (${freshness.reason}).`],
    };
  }
  if (options.policy !== "refresh") {
    const detail = freshness.kind === "stale" ? `stale (${freshness.reason})` : freshness.kind;
    throw new SurveyScanError(`The project scan is ${detail}; policy "${options.policy}" does not permit refresh.`);
  }
  const result = scanProject({ ...options, force: true });
  return {
    model: result.model,
    fingerprint: result.fingerprint,
    wasStale: freshness.kind === "stale",
    refreshed: true,
    diagnostics: result.diagnostics,
  };
}

export function computeScanDelta(previous: CanonicalComponentModel | undefined, current: CanonicalComponentModel): ScanDelta {
  const before = new Map((previous?.components ?? []).map((component) => [component.id, component]));
  const after = new Map(current.components.map((component) => [component.id, component]));
  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const removed: string[] = [];
  for (const [id, component] of after) {
    const old = before.get(id);
    if (old === undefined) added.push(id);
    else if (canonicalComponent(old) === canonicalComponent(component)) unchanged.push(id);
    else changed.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  return { new: added.sort(), changed: changed.sort(), unchanged: unchanged.sort(), removed: removed.sort() };
}

function unchangedDelta(model: CanonicalComponentModel): ScanDelta {
  return { new: [], changed: [], unchanged: model.components.map(({ id }) => id).sort(), removed: [] };
}

function currentInputs(options: Pick<ApplyScanPolicyOptions, "root" | "sourceDirectory" | "ignorePatterns">): CurrentInputs {
  const files = findSourceFiles(options.root, options.ignorePatterns, options.sourceDirectory);
  const hashes = hashSourceFiles(options.root, files);
  return { hashes, fingerprint: computeScanFingerprint({ root: options.root, sourceHashes: hashes, ignorePatterns: options.ignorePatterns }) };
}

function classifyInvalidModel(path: string): "corrupt" | "incompatible" {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
    if (typeof value === "object" && value !== null && value.version !== 2) {
      return "incompatible";
    }
  } catch {
    return "corrupt";
  }
  return "corrupt";
}

function canonicalComponent(component: CanonicalComponent): string {
  return stableJson(component);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
