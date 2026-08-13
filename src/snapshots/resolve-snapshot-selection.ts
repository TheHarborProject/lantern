import { CliOptionConflictError } from "../errors/cli-option-conflict-error.js";
import type { SnapshotSelection } from "../types/snapshot-selection.js";

export interface SnapshotCliOptions {
  readonly runName?: string | undefined;
  readonly partial?: boolean | undefined;
  readonly route?: string | undefined;
  readonly user?: string | undefined;
}

/**
 * Translate default-command CLI options (RFC-010) into a typed
 * {@link SnapshotSelection}. Explicitly validate forbidden combinations
 * before touching configuration or the browser.
 *
 * @throws {CliOptionConflictError} Incompatible option combination.
 */
export function resolveSnapshotSelection(options: SnapshotCliOptions): SnapshotSelection {
  const { runName, partial, route, user } = options;

  if (partial === true && runName === undefined) {
    throw new CliOptionConflictError("--partial requires --runName.");
  }

  if (user !== undefined && route === undefined) {
    throw new CliOptionConflictError("--user requires --route.");
  }

  if (user !== undefined && runName !== undefined) {
    throw new CliOptionConflictError(
      "--user cannot be combined with --runName. Configure the run user in the SnapRun configuration instead.",
    );
  }

  if (runName !== undefined && route !== undefined) {
    return { kind: "run-route", runName, routePath: route };
  }

  if (runName !== undefined) {
    return { kind: "run", runName };
  }

  if (route !== undefined) {
    return { kind: "route", routePath: route, user };
  }

  return { kind: "all" };
}
