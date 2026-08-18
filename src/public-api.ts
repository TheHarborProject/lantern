/**
 * RFC-009/009.1 public API boundary.
 *
 * `AuditWireDto` (and its nested `AuditWire*` types) is the versioned,
 * external contract: stable across internal refactors, safe to persist,
 * safe to hand to a process in another language (a future Go TUI). Prefer it
 * for anything that outlives one function call.
 *
 * `LintReport` is the internal domain report `runAudit()` also returns
 * alongside `wire`, for same-process debugging/tooling convenience. It is
 * not a versioned contract — its shape can change between any two RFC-009.x
 * releases without notice. Do not treat it as equivalent to the wire DTO.
 */
export { discoverComponents, resolveProject, runAudit, runSurvey, scan } from "./api/service.js";
export { auditWireSchema, toAuditWireDto } from "./api/wire.js";
export { surveyRunV1Schema, parseSurveyRun } from "./survey/schema/survey-run.js";
export { renderSurveyRun } from "./survey/render-survey-run.js";
export { shouldPersistSurveyRun, deliverSurveyRun } from "./survey/persistence.js";
export { serializeSurveyRun, parseStoredSurveyRun } from "./history/codec.js";
export { saveSurveyRun, readSurveyRun, listSurveyRuns, deleteSurveyRun } from "./history/repository.js";
export { resolveSurveyRun, limitSurveyRuns, displaySurveyId } from "./history/catalog.js";
export { applyRetention, parseDuration } from "./history/retention.js";
export { resolveSurveyHistoryOptions } from "./history/path.js";
export { createSurveyHistorySink, listProjectSurveyRuns, resolveProjectSurveyRun, readProjectSurveyRun, exportSurveyRun, deleteProjectSurveyRun } from "./history/service.js";
export type { AuditRequest, ProjectRequest, SurveyRequest } from "./api/service.js";
export type { SurveyRunV1, SurveyConfigSnapshotV1, SurveyDiagnosticV1, SurveyGitSnapshotV1, SurveyProjectSnapshotV1, SurveyTargetingSnapshotV1 } from "./survey/schema/survey-run.js";
export type { SurveyEvent, SurveyEventSink } from "./survey/events.js";
export type { SurveyRunSink } from "./survey/persistence.js";
export type { SurveyHistoryListing, SurveyHistoryOptions, SurveyHistoryProblem, SurveyHistoryProblemKind, RetentionResult } from "./history/types.js";
export type {
  AuditWireCheck,
  AuditWireComponent,
  AuditWireDiagnostic,
  AuditWireDto,
  AuditWireEngine,
  AuditWireEvidence,
  AuditWireOutcomeReason,
  AuditWirePropProvenance,
  AuditWireSource,
  AuditWireStandard,
  AuditWireState,
  AuditWireSummary,
} from "./api/wire.js";
export type { AuditEvent, AuditEventSink } from "./lint/events.js";
/** Internal, unversioned domain report — see the module doc above. */
export type { LintReport } from "./lint/types.js";
