import { SurveyHistoryError } from "../errors/survey-history-error.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import { listSurveyRuns } from "./repository.js";
import type { SurveyHistoryListing, SurveyHistoryOptions } from "./types.js";

export function resolveSurveyRun(options: SurveyHistoryOptions, selector: string): SurveyRunV1 {
  const listing = listSurveyRuns(options);
  if (selector === "last") {
    const latest = listing.runs[0];
    if (latest === undefined) throw new SurveyHistoryError("empty", "No saved surveys exist in this project.");
    return latest;
  }
  const matches = listing.runs.filter((run) => run.id.startsWith(selector));
  if (matches.length === 0) {
    const invalidMatch = listing.problems.find((problem) => problem.file.startsWith(selector));
    if (invalidMatch !== undefined) throw new SurveyHistoryError(invalidMatch.kind === "unsupported-version" ? "unsupported-version" : "corrupt", invalidMatch.message);
    throw new SurveyHistoryError("unknown-id", `No saved survey matches "${selector}".`);
  }
  if (matches.length > 1) {
    throw new SurveyHistoryError("ambiguous-id", `Survey prefix "${selector}" is ambiguous: ${matches.map(({ id }) => id).join(", ")}`);
  }
  return matches[0] as SurveyRunV1;
}

export function limitSurveyRuns(listing: SurveyHistoryListing, maximum: number): SurveyHistoryListing {
  return { runs: listing.runs.slice(0, maximum), problems: listing.problems };
}

export function displaySurveyId(run: SurveyRunV1, allRuns: readonly SurveyRunV1[], minimum = 7): string {
  for (let length = minimum; length <= run.id.length; length += 1) {
    const prefix = run.id.slice(0, length);
    if (allRuns.filter(({ id }) => id.startsWith(prefix)).length === 1) return prefix;
  }
  return run.id;
}
