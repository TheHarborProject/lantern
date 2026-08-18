import { z } from "zod";
import type { LintReport } from "../lint/types.js";
import type { SurveyRunV1 } from "../survey/schema/survey-run.js";

/**
 * Wire v1 (RFC-009/009.1): the versioned, external contract for a
 * non-TypeScript consumer (a future Go TUI). This schema is written
 * independently of the internal `LintReport` v3 domain type — every field a
 * consumer needs (components, states, checks, evidence, engines,
 * diagnostics, provenance, source, timing) has its own explicit shape here,
 * not a generic "some JSON" placeholder. `toAuditWireDto` below is the only
 * conversion point; `.parse()`-ing through this schema means an internal
 * rename or shape change fails loudly (a thrown ZodError) instead of
 * silently changing what a Go client receives.
 *
 * Only genuinely open-ended domain data — a state's resolved component prop
 * values, and a dimension's candidate values, both arbitrary fixture/config
 * data — falls back to `jsonValue`. Everything structural about the audit
 * model itself is typed.
 */
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

const wireSourceLocationSchema = z.object({
  file: z.string(),
  line: z.number().finite().optional(),
  column: z.number().finite().optional(),
  endLine: z.number().finite().optional(),
  endColumn: z.number().finite().optional(),
});
export type AuditWireSource = z.infer<typeof wireSourceLocationSchema>;

const wireOutcomeReasonSchema = z.enum([
  "unsupported",
  "unavailable",
  "inconclusive",
  "manual-review",
  "not-applicable",
  "skipped",
  "partial-analysis",
  "operational-error",
]);
export type AuditWireOutcomeReason = z.infer<typeof wireOutcomeReasonSchema>;

const wireEvidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("observation"), name: z.string(), value: jsonValue }),
  z.object({ kind: z.literal("expectation"), expected: z.string(), observed: z.string() }),
  z.object({ kind: z.literal("element"), selector: z.string().optional(), html: z.string().optional() }),
  z.object({ kind: z.literal("attribute"), name: z.string(), value: jsonValue }),
  z.object({ kind: z.literal("source"), location: wireSourceLocationSchema }),
  z.object({
    kind: z.literal("capability"),
    required: z.string(),
    attempts: z.array(z.object({ engine: z.string(), reason: z.string() })),
  }),
]);
export type AuditWireEvidence = z.infer<typeof wireEvidenceSchema>;

const wireEngineProvenanceSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  nativeRuleId: z.string().optional(),
});

const wireCheckSchema = z.object({
  checkId: z.string(),
  componentId: z.string(),
  stateId: z.string(),
  ruleId: z.string(),
  severity: z.enum(["warn", "error"]),
  status: z.enum(["pass", "fail", "review"]),
  message: z.string().optional(),
  location: wireSourceLocationSchema.optional(),
  engine: wireEngineProvenanceSchema.optional(),
  outcomeReason: wireOutcomeReasonSchema.optional(),
  reason: z.string().optional(),
  evidence: z.array(wireEvidenceSchema),
  durationMs: z.number().nonnegative().finite(),
});
export type AuditWireCheck = z.infer<typeof wireCheckSchema>;

const wirePropProvenanceSchema = z.record(z.enum(["explicit", "fixture", "inferred"]));
export type AuditWirePropProvenance = z.infer<typeof wirePropProvenanceSchema>;

const wireStateSchema = z.object({
  componentId: z.string(),
  stateId: z.string(),
  props: z.record(jsonValue),
  propProvenance: wirePropProvenanceSchema,
  checks: z.array(wireCheckSchema),
  status: z.enum(["pass", "fail", "review", "skipped"]),
  outcomeReason: wireOutcomeReasonSchema.optional(),
  reason: z.string().optional(),
});
export type AuditWireState = z.infer<typeof wireStateSchema>;

const wireDimensionSchema = z.object({
  name: z.string(),
  values: z.array(jsonValue),
  source: z.enum(["explicit", "fixture", "inferred"]),
});

const wireComponentSchema = z.object({
  componentId: z.string(),
  component: z.string(),
  source: z.string(),
  planStatus: z.enum(["ready", "unresolved", "skipped"]),
  status: z.enum(["pass", "fail", "review", "skipped"]),
  outcomeReason: wireOutcomeReasonSchema.optional(),
  states: z.array(wireStateSchema),
  dimensions: z.array(wireDimensionSchema).optional(),
  reason: z.string().optional(),
  truncated: z.boolean(),
  totalPossibleStates: z.number().nonnegative().finite(),
  maxStates: z.number().nonnegative().finite(),
});
export type AuditWireComponent = z.infer<typeof wireComponentSchema>;

const wireStandardSchema = z.object({
  standard: z.string(),
  components: z.array(wireComponentSchema),
});
export type AuditWireStandard = z.infer<typeof wireStandardSchema>;

const wireEngineSchema = z.object({
  id: z.string(),
  version: z.string(),
  capabilities: z.array(z.string()),
});
export type AuditWireEngine = z.infer<typeof wireEngineSchema>;

const wireDiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  scope: z.enum(["run", "component", "state", "check", "engine"]),
  source: z.string(),
  component: z.string().optional(),
  componentId: z.string().optional(),
  stateId: z.string().optional(),
  checkId: z.string().optional(),
  engine: z.object({ name: z.string(), version: z.string().optional() }).optional(),
  message: z.string(),
});
export type AuditWireDiagnostic = z.infer<typeof wireDiagnosticSchema>;

const wireSummarySchema = z.object({
  componentsPass: z.number().nonnegative().finite(),
  componentsFail: z.number().nonnegative().finite(),
  componentsReview: z.number().nonnegative().finite(),
  componentsSkipped: z.number().nonnegative().finite(),
  checksPass: z.number().nonnegative().finite(),
  checksFail: z.number().nonnegative().finite(),
  checksReview: z.number().nonnegative().finite(),
  durationMs: z.number().nonnegative().finite(),
});
export type AuditWireSummary = z.infer<typeof wireSummarySchema>;

const wireTargetModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("incremental") }),
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("since"), ref: z.string() }),
  z.object({ kind: z.literal("path"), path: z.string() }),
]);

const wireTargetSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("none"), reason: z.string().optional() }),
  z.object({ kind: z.literal("affected"), componentCount: z.number().nonnegative().finite() }),
  z.object({
    kind: z.literal("path"),
    path: z.string(),
    pathKind: z.enum(["file", "directory"]),
    componentCount: z.number().nonnegative().finite(),
  }),
  z.object({ kind: z.literal("fallback"), reason: z.string(), details: z.array(z.string()).optional() }),
]);

const wireTargetingSchema = z.object({
  mode: wireTargetModeSchema,
  rescanned: z.boolean(),
  selection: wireTargetSelectionSchema.optional(),
});

const wireConfigSchema = z.object({
  standards: z.array(z.string()),
  rules: z.record(z.string()),
});

/** External contract version, intentionally independent from the domain report version. */
export const auditWireSchema = z.object({
  version: z.literal(1),
  run: z.object({
    id: z.string(),
    startedAt: z.string(),
    finishedAt: z.string(),
    status: z.enum(["completed", "failed", "cancelled"]),
    durationMs: z.number().nonnegative().finite(),
  }),
  targeting: wireTargetingSchema,
  engines: z.array(wireEngineSchema),
  config: wireConfigSchema,
  diagnostics: z.array(wireDiagnosticSchema),
  standards: z.array(wireStandardSchema),
  summary: wireSummarySchema,
});

export type AuditWireDto = z.infer<typeof auditWireSchema>;

/**
 * Explicit domain-to-wire conversion: no runtime/domain objects cross this
 * boundary, and `.parse()` re-validates every field against wire v1's own
 * shape (see the module doc above) rather than trusting the internal
 * `LintReport` shape by construction.
 */
export function toAuditWireDto(value: LintReport | SurveyRunV1): AuditWireDto {
  const report = "schema" in value ? toLegacyLintReport(value) : value;
  return auditWireSchema.parse({
    version: 1,
    run: {
      id: report.runId,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      status: report.status,
      durationMs: report.summary.durationMs,
    },
    targeting: report.targeting,
    engines: report.engines,
    config: report.config,
    diagnostics: report.diagnostics ?? [],
    standards: report.standards,
    summary: report.summary,
  });
}

/** @deprecated Compatibility-only view for RFC-009 consumers. */
export function toLegacyLintReport(run: SurveyRunV1): LintReport {
  const mode = run.targeting.source === "path"
    ? { kind: "path" as const, path: run.targeting.path ?? "." }
    : run.targeting.source === "since"
      ? { kind: "since" as const, ref: run.targeting.ref ?? "" }
      : { kind: "all" as const };
  return {
    version: 3,
    runId: run.id,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    status: run.status,
    generatedAt: run.startedAt,
    targeting: { mode, rescanned: run.targeting.scan.refreshed, selection: { kind: "all" } },
    provider: run.engines.length === 0
      ? { kind: "unavailable", reason: "no engines were enabled" }
      : { kind: "available", provider: run.engines.map((engine) => `${engine.id}@${engine.version}`).join(", ") },
    engines: run.engines,
    config: {
      standards: run.config.standards,
      rules: Object.fromEntries(Object.entries(run.config.rules).map(([id, rule]) => [id, rule.severity])),
    },
    diagnostics: run.diagnostics,
    standards: run.standards,
    summary: run.summary,
  };
}
