import { RunNotFoundError } from "../errors/run-not-found-error.js";
import type { RawRun } from "../types/run.js";

/** @throws {RunNotFoundError} No run has this name. */
export function findRunByName(runs: readonly RawRun[], runName: string): RawRun {
  const run = runs.find((candidate) => candidate.runName === runName);

  if (run === undefined) {
    throw new RunNotFoundError(runName);
  }

  return run;
}
