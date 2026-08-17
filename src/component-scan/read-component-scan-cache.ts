import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import { COMPONENT_SCAN_CACHE_PATH } from "./artifact-paths.js";

/**
 * Read the cached canonical component model written by a previous scan.
 * Never throws: a missing, unreadable, or structurally invalid cache is
 * reported as `undefined` so callers safely fall back to rescanning (RFC-007)
 * rather than trusting corrupt internal state.
 */
export function readComponentScanCache(root: string): CanonicalComponentModel | undefined {
  try {
    const raw = readFileSync(join(root, COMPONENT_SCAN_CACHE_PATH), "utf-8");
    const data = JSON.parse(raw) as unknown;
    return isCanonicalComponentModel(data) ? data : undefined;
  } catch {
    return undefined;
  }
}

function isCanonicalComponentModel(data: unknown): data is CanonicalComponentModel {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as { version?: unknown; components?: unknown; diagnostics?: unknown };
  return (
    candidate.version === 2 &&
    Array.isArray(candidate.components) &&
    candidate.components.every(isCanonicalComponent) &&
    Array.isArray(candidate.diagnostics) &&
    candidate.diagnostics.every(isScanDiagnostic)
  );
}

function isCanonicalComponent(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.source === "string" &&
    typeof candidate.exportName === "string" &&
    typeof candidate.name === "string" &&
    (candidate.exportKind === "named" || candidate.exportKind === "default") &&
    Array.isArray(candidate.props) &&
    candidate.props.every(isResolvedProp) &&
    typeof candidate.rendering === "object" &&
    candidate.rendering !== null &&
    typeof candidate.analysis === "object" &&
    candidate.analysis !== null
  );
}

function isResolvedProp(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.required === "boolean" &&
    (candidate.origin === "component" ||
      candidate.origin === "project-inherited" ||
      candidate.origin === "external-inherited") &&
    typeof candidate.provenance === "string" &&
    typeof candidate.ownerProvenance === "string"
  );
}

function isScanDiagnostic(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Record<string, unknown>;
  return (
    typeof candidate.source === "string" &&
    typeof candidate.exportName === "string" &&
    typeof candidate.message === "string"
  );
}
