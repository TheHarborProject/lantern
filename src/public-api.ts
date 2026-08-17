export { discoverComponents, resolveProject, runAudit } from "./api/service.js";
export { auditWireSchema, toAuditWireDto } from "./api/wire.js";
export type { AuditRequest, ProjectRequest } from "./api/service.js";
export type { AuditWireDto } from "./api/wire.js";
export type { AuditEvent, AuditEventSink } from "./lint/events.js";
export type { CheckResult, EvidenceRecord, LintReport, OutcomeReason, SourceLocation } from "./lint/types.js";
