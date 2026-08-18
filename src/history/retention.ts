import { SurveyHistoryError } from "../errors/survey-history-error.js";
import { deleteSurveyRun, listSurveyRuns } from "./repository.js";
import type { RetentionResult, SurveyHistoryOptions } from "./types.js";

export function applyRetention(options: SurveyHistoryOptions, now = Date.now()): RetentionResult {
  const listing = listSurveyRuns(options);
  if (listing.problems.length > 0) {
    throw new SurveyHistoryError("corrupt", `Retention stopped because ${listing.problems.length} invalid history file${listing.problems.length === 1 ? " was" : "s were"} found.`);
  }
  const deleted = new Set<string>();
  let remaining = [...listing.runs];
  if (options.maxAge !== undefined) {
    const cutoff = now - parseDuration(options.maxAge);
    for (const run of remaining) if (Date.parse(run.startedAt) < cutoff) deleted.add(run.id);
    remaining = remaining.filter(({ id }) => !deleted.has(id));
  }
  if (options.maxRuns !== undefined) for (const run of remaining.slice(options.maxRuns)) deleted.add(run.id);
  const deletedIds = [...deleted].sort();
  for (const id of deletedIds) deleteSurveyRun(options, id);
  return { deletedIds };
}

export function parseDuration(value: string): number {
  const match = /^([1-9]\d*)(m|h|d|w)$/.exec(value);
  if (match === null) throw new SurveyHistoryError("corrupt", `Invalid retention duration "${value}".`);
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : unit === "d" ? 86_400_000 : 604_800_000;
  return amount * multiplier;
}
