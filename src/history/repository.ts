import { closeSync, existsSync, fsyncSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { SurveyHistoryError } from "../errors/survey-history-error.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import { parseStoredSurveyRun, serializeSurveyRun } from "./codec.js";
import type { SurveyHistoryListing, SurveyHistoryOptions, SurveyHistoryProblem } from "./types.js";

const RUN_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i;

export function saveSurveyRun(options: SurveyHistoryOptions, run: SurveyRunV1): void {
  const content = serializeSurveyRun(run);
  mkdirSync(options.directory, { recursive: true });
  const target = runPath(options, run.id);
  if (existsSync(target)) {
    const existing = readFileSync(target, "utf8");
    if (existing === content) return;
    throw new SurveyHistoryError("conflict", `Survey ${run.id} already exists with different content.`);
  }
  const temporary = join(options.directory, `.${run.id}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, content, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    parseStoredSurveyRun(readFileSync(temporary, "utf8"));
    linkSync(temporary, target);
    unlinkSync(temporary);
  } catch (cause) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) unlinkSync(temporary);
    if (cause instanceof SurveyHistoryError) throw cause;
    const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
    if (code === "EEXIST") throw new SurveyHistoryError("conflict", `Survey ${run.id} was saved concurrently.`, { cause });
    throw new SurveyHistoryError("io", `Could not save survey ${run.id}.`, { cause });
  }
}

export function readSurveyRun(options: SurveyHistoryOptions, id: string): SurveyRunV1 {
  const path = runPath(options, id);
  if (!existsSync(path)) throw new SurveyHistoryError("unknown-id", `No saved survey matches "${id}".`);
  return readRunFile(path, id);
}

export function listSurveyRuns(options: SurveyHistoryOptions): SurveyHistoryListing {
  if (!existsSync(options.directory)) return { runs: [], problems: [] };
  let names: string[];
  try {
    names = readdirSync(options.directory).filter((name) => name.endsWith(".json")).sort();
  } catch (cause) {
    throw new SurveyHistoryError("io", `Could not read survey history at ${options.directory}.`, { cause });
  }
  const runs: SurveyRunV1[] = [];
  const problems: SurveyHistoryProblem[] = [];
  for (const name of names) {
    const match = RUN_FILE.exec(name);
    if (match === null) {
      problems.push({ file: name, kind: "corrupt", message: "Authoritative survey filename is not a full run ID." });
      continue;
    }
    const expectedId = match[1]?.toLowerCase() ?? "";
    try {
      const run = readRunFile(join(options.directory, name), expectedId);
      runs.push(run);
    } catch (error) {
      const historyError = error instanceof SurveyHistoryError ? error : new SurveyHistoryError("corrupt", "Could not decode stored survey.", { cause: error });
      problems.push({ file: name, kind: historyError.kind === "unsupported-version" ? "unsupported-version" : historyError.kind === "conflict" ? "conflict" : "corrupt", message: historyError.message });
    }
  }
  return { runs: runs.sort(compareSurveyRuns), problems };
}

export function deleteSurveyRun(options: SurveyHistoryOptions, id: string): void {
  const path = runPath(options, id);
  try {
    unlinkSync(path);
  } catch (cause) {
    throw new SurveyHistoryError("io", `Could not delete survey ${id}.`, { cause });
  }
}

export function compareSurveyRuns(left: SurveyRunV1, right: SurveyRunV1): number {
  const time = right.startedAt.localeCompare(left.startedAt);
  return time !== 0 ? time : left.id.localeCompare(right.id);
}

function readRunFile(path: string, expectedId: string): SurveyRunV1 {
  let run: SurveyRunV1;
  try {
    run = parseStoredSurveyRun(readFileSync(path, "utf8"));
  } catch (cause) {
    if (cause instanceof SurveyHistoryError) throw cause;
    throw new SurveyHistoryError("io", `Could not read stored survey ${basename(path)}.`, { cause });
  }
  if (run.id.toLowerCase() !== expectedId.toLowerCase()) {
    throw new SurveyHistoryError("conflict", `Survey filename does not match payload ID ${run.id}.`);
  }
  return run;
}

function runPath(options: SurveyHistoryOptions, id: string): string {
  if (!RUN_FILE.test(`${id}.json`)) throw new SurveyHistoryError("unknown-id", `Invalid full survey ID "${id}".`);
  return join(options.directory, `${id}.json`);
}
