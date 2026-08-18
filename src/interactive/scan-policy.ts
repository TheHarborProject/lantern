import { InteractiveSurveyError } from "../errors/interactive-survey-error.js";
import { inspectScanState, scanProject } from "../scan/scan-service.js";
import type { ResolvedConfig } from "../types/config.js";
import type { ScanDelta } from "../scan/types.js";
import type { InteractiveSurveyPrompter, ResolvedInteractiveScan } from "./types.js";

export async function resolveInteractiveScan(config: ResolvedConfig, prompter: Pick<InteractiveSurveyPrompter, "chooseStaleScan">): Promise<ResolvedInteractiveScan | null> {
  const options = { root: config.project.root, sourceDirectory: config.project.sourceDirectory, ignorePatterns: config.ignorePatterns };
  const freshness = inspectScanState(options);
  if (freshness.kind === "fresh") {
    return { scan: { model: freshness.model, fingerprint: freshness.fingerprint, wasStale: false, refreshed: false, diagnostics: [] }, delta: unchanged(freshness.model.components.map(({ id }) => id)), effectivePolicy: "current", notes: [] };
  }
  if (freshness.kind === "missing" || freshness.kind === "invalid") {
    if (config.survey.scan.interactive.missing === "error") throw new InteractiveSurveyError(`The project scan is ${freshness.kind}; interactive policy does not permit scanning.`);
    const result = scanProject({ ...options, force: true });
    return { scan: { model: result.model, fingerprint: result.fingerprint, wasStale: false, refreshed: true, diagnostics: result.diagnostics }, delta: result.delta, effectivePolicy: "refresh", notes: freshness.kind === "invalid" ? ["The invalid scan was rebuilt; it was never used as current."] : [] };
  }
  const action: "refresh" | "current" | "error" | "cancel" = config.survey.scan.interactive.stale === "prompt"
    ? await prompter.chooseStaleScan(freshness.reason)
    : config.survey.scan.interactive.stale;
  if (action === "cancel") return null;
  if (action === "error") throw new InteractiveSurveyError(`The project scan is stale (${freshness.reason}); interactive policy is "error".`);
  if (action === "current") {
    return {
      scan: { model: freshness.model, fingerprint: freshness.fingerprint, wasStale: true, refreshed: false, diagnostics: [`Using the previous scan by interactive choice (${freshness.reason}).`] },
      delta: unchanged(freshness.model.components.map(({ id }) => id)), effectivePolicy: "current",
      notes: ["The previous scan has no current delta; changed selection starts empty."],
    };
  }
  const result = scanProject({ ...options, force: true });
  return { scan: { model: result.model, fingerprint: result.fingerprint, wasStale: true, refreshed: true, diagnostics: result.diagnostics }, delta: result.delta, effectivePolicy: "refresh", notes: [] };
}

function unchanged(ids: readonly string[]): ScanDelta { return { new: [], changed: [], unchanged: [...ids].sort(), removed: [] }; }
