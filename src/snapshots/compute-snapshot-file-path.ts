import { join } from "node:path";
import type { RawRoute } from "../types/route.js";
import { sanitizePathSegment } from "./sanitize-path-segment.js";

export type SnapshotTarget =
  | {
      readonly structure?: "flat" | "run" | "scope";
      readonly kind: "run";
      readonly runName: string;
      readonly index: number;
      readonly routeId: string;
      readonly scope?: RawRoute["scope"];
      readonly runId?: string | undefined;
    }
  | {
      readonly structure?: "flat" | "run" | "scope";
      readonly kind: "standalone";
      readonly routeId: string;
      readonly scope?: RawRoute["scope"];
      readonly runId?: string | undefined;
    };

/**
 * Deterministic file path for a capture (RFC-009):
 * - run: `<outputDirectory>/<runName>/<NN>-<routeId>.png`, where `NN` is the
 *   1-based route position in the run capture order, zero-padded to at least
 *   2 digits;
 * - standalone: `<outputDirectory>/standalone/<routeId>.png`, with no
 *   numeric prefix because run ordering does not apply.
 */
export function computeSnapshotFilePath(outputDirectory: string, target: SnapshotTarget): string {
  const structure = target.structure ?? "flat";
  const routeId = sanitizePathSegment("route id", target.routeId);

  if (structure === "run") {
    if (target.runId === undefined) {
      throw new Error("runId is required when output.structure is 'run'.");
    }

    return join(
      outputDirectory,
      "run",
      sanitizePathSegment("run id", target.runId),
      routeId,
      "page.png",
    );
  }

  if (structure === "scope") {
    return join(
      outputDirectory,
      sanitizePathSegment("scope", target.scope ?? "unscoped"),
      routeId,
      "page.png",
    );
  }

  if (target.kind === "standalone") {
    return join(outputDirectory, "standalone", `${routeId}.png`);
  }

  const sequence = String(target.index).padStart(2, "0");
  return join(
    outputDirectory,
    sanitizePathSegment("run name", target.runName),
    `${sequence}-${routeId}.png`,
  );
}
