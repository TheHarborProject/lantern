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
export { discoverComponents, resolveProject, runAudit } from "./api/service.js";
export { auditWireSchema, toAuditWireDto } from "./api/wire.js";
export type { AuditRequest, ProjectRequest } from "./api/service.js";
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
