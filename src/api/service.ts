import { loadConfig } from "../config/load-config.js";
import type { BuildLintReportOptions } from "../lint/build-lint-report.js";
import type { LintTargetMode } from "../lint/types.js";
import { toAuditWireDto, toLegacyLintReport } from "./wire.js";
import type { ResolvedConfig } from "../types/config.js";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import type { AuditWireDto } from "./wire.js";
import type { LintReport } from "../lint/types.js";
import { runSurvey as executeSurvey, type RunSurveyOptions, type SurveySelectionRequest } from "../survey/run-survey.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";
import { scanProject } from "../scan/scan-service.js";
import type { ScanResult } from "../scan/types.js";
import type { SurveyEvent } from "../survey/events.js";
import type { AuditEventSink } from "../lint/events.js";

export interface ProjectRequest { readonly cwd?: string; readonly configPath?: string }
export interface AuditRequest extends ProjectRequest {
  readonly mode?: LintTargetMode;
  readonly selection?: { readonly componentIds?: readonly string[]; readonly stateIds?: readonly string[]; readonly checkIds?: readonly string[] };
  readonly signal?: AbortSignal;
  readonly events?: BuildLintReportOptions["events"];
}
export interface SurveyRequest extends ProjectRequest {
  readonly selection?: SurveySelectionRequest;
  readonly name?: string;
  readonly signal?: AbortSignal;
  readonly events?: RunSurveyOptions["events"];
}

export function resolveProject(request: ProjectRequest = {}): ResolvedConfig {
  return loadConfig({ cwd: request.cwd ?? process.cwd(), ...(request.configPath === undefined ? {} : { explicitPath: request.configPath }) });
}

export function discoverComponents(request: ProjectRequest = {}): CanonicalComponentModel {
  const config = resolveProject(request);
  return scanProject({ root: config.project.root, sourceDirectory: config.project.sourceDirectory, ignorePatterns: config.ignorePatterns }).model;
}

export function scan(request: ProjectRequest & { readonly all?: boolean } = {}): ScanResult {
  const config = resolveProject(request);
  return scanProject({ root: config.project.root, sourceDirectory: config.project.sourceDirectory, ignorePatterns: config.ignorePatterns, force: request.all === true });
}

export async function runSurvey(request: SurveyRequest = {}): Promise<SurveyRunV1> {
  const config = resolveProject(request);
  return executeSurvey({
    config,
    ...(request.selection === undefined ? {} : { selection: request.selection }),
    ...(request.name === undefined ? {} : { name: request.name }),
    ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
    ...(request.events === undefined ? {} : { events: request.events }),
  });
}

export async function runAudit(request: AuditRequest = {}): Promise<{ readonly report: LintReport; readonly wire: AuditWireDto }> {
  const config = resolveProject(request);
  const mode = request.mode ?? { kind: "incremental" };
  const selection: SurveySelectionRequest = request.selection?.componentIds !== undefined
    ? { kind: "programmatic", componentIds: request.selection.componentIds,
        ...(request.selection.stateIds === undefined ? {} : { stateIds: request.selection.stateIds }),
        ...(request.selection.checkIds === undefined ? {} : { checkIds: request.selection.checkIds }) }
    : mode.kind === "path" ? { kind: "path", path: mode.path }
      : mode.kind === "since" ? { kind: "since", ref: mode.ref } : { kind: "all" };
  const run = await executeSurvey({ config, selection,
    ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
    ...(request.events === undefined ? {} : { events: legacyEventAdapter(request.events) }) });
  const report = toLegacyLintReport(run);
  return { report, wire: toAuditWireDto(run) };
}

function legacyEventAdapter(sink: AuditEventSink): (event: SurveyEvent) => void | Promise<void> {
  return (event) => {
    if ("run" in event) {
      const type = event.type === "survey-completed" ? "run-completed" : event.type === "survey-failed" ? "run-failed" : "run-cancelled";
      return sink({ type, runId: event.runId, timestamp: event.timestamp, report: toLegacyLintReport(event.run) });
    }
    if (event.type === "survey-started") return sink({ ...event, type: "run-started" });
    if (event.type === "survey-planned") return sink({ ...event, type: "run-planned" });
    return sink(event);
  };
}
