import { z } from "zod";

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const sourceSchema = z.object({
  file: z.string(), line: z.number().finite().optional(), column: z.number().finite().optional(),
  endLine: z.number().finite().optional(), endColumn: z.number().finite().optional(),
}).strict();
const outcomeSchema = z.enum(["unsupported", "unavailable", "inconclusive", "manual-review", "not-applicable", "skipped", "partial-analysis", "operational-error"]);
const evidenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("observation"), name: z.string(), value: jsonValueSchema }).strict(),
  z.object({ kind: z.literal("expectation"), expected: z.string(), observed: z.string() }).strict(),
  z.object({ kind: z.literal("element"), selector: z.string().optional(), html: z.string().optional() }).strict(),
  z.object({ kind: z.literal("attribute"), name: z.string(), value: jsonValueSchema }).strict(),
  z.object({ kind: z.literal("source"), location: sourceSchema }).strict(),
  z.object({ kind: z.literal("capability"), required: z.string(), attempts: z.array(z.object({ engine: z.string(), reason: z.string() }).strict()) }).strict(),
]);
const checkSchema = z.object({
  checkId: z.string(), componentId: z.string(), stateId: z.string(), ruleId: z.string(), severity: z.enum(["warn", "error"]),
  status: z.enum(["pass", "fail", "review"]), message: z.string().optional(), location: sourceSchema.optional(),
  engine: z.object({ name: z.string(), version: z.string().optional(), nativeRuleId: z.string().optional() }).strict().optional(),
  outcomeReason: outcomeSchema.optional(), reason: z.string().optional(), evidence: z.array(evidenceSchema), durationMs: z.number().nonnegative().finite(),
}).strict();
const stateSchema = z.object({
  componentId: z.string(), stateId: z.string(), props: z.record(jsonValueSchema),
  propProvenance: z.record(z.enum(["explicit", "fixture", "inferred"])), checks: z.array(checkSchema),
  status: z.enum(["pass", "fail", "review", "skipped"]), outcomeReason: outcomeSchema.optional(), reason: z.string().optional(),
}).strict();
const componentSchema = z.object({
  componentId: z.string(), component: z.string(), source: z.string(), planStatus: z.enum(["ready", "unresolved", "skipped"]),
  status: z.enum(["pass", "fail", "review", "skipped"]), outcomeReason: outcomeSchema.optional(), states: z.array(stateSchema),
  dimensions: z.array(z.object({ name: z.string(), values: z.array(jsonValueSchema), source: z.enum(["explicit", "fixture", "inferred"]) }).strict()).optional(),
  unresolvedProps: z.array(z.object({ name: z.string(), type: z.string(), reason: z.string() }).passthrough()).optional(),
  reason: z.string().optional(), truncated: z.boolean(), totalPossibleStates: z.number().nonnegative().finite(), maxStates: z.number().nonnegative().finite(),
}).strict();
const diagnosticSchema = z.object({
  code: z.string(), severity: z.enum(["info", "warning", "error"]), scope: z.enum(["run", "component", "state", "check", "engine"]),
  source: z.string(), component: z.string().optional(), componentId: z.string().optional(), stateId: z.string().optional(), checkId: z.string().optional(),
  engine: z.object({ name: z.string(), version: z.string().optional() }).strict().optional(), message: z.string(),
}).strict();
const summarySchema = z.object({
  componentsPass: z.number().nonnegative().finite(), componentsFail: z.number().nonnegative().finite(),
  componentsReview: z.number().nonnegative().finite(), componentsSkipped: z.number().nonnegative().finite(),
  checksPass: z.number().nonnegative().finite(), checksFail: z.number().nonnegative().finite(), checksReview: z.number().nonnegative().finite(),
  durationMs: z.number().nonnegative().finite(),
}).strict();

export const surveyRunV1Schema = z.object({
  schema: z.literal("lantern-survey-run"),
  version: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  status: z.enum(["completed", "failed", "cancelled"]),
  project: z.object({ fingerprint: z.string().length(64), name: z.string().optional() }).strict(),
  git: z.object({ commit: z.string().optional(), branch: z.string().optional(), dirty: z.boolean() }).strict().optional(),
  targeting: z.object({
    source: z.enum(["all", "path", "since", "programmatic", "interactive"]),
    path: z.string().optional(), ref: z.string().optional(), componentIds: z.array(z.string()), stateIds: z.array(z.string()).optional(),
    scan: z.object({ fingerprint: z.string().length(64), wasStale: z.boolean(), refreshed: z.boolean() }).strict(),
  }).strict(),
  config: z.object({
    schemaVersion: z.literal(1), fingerprint: z.string().length(64), standards: z.array(z.string()),
    rules: z.record(z.object({ severity: z.enum(["off", "warn", "error"]), options: jsonValueSchema.optional() }).strict()),
    engines: z.record(z.object({ enabled: z.boolean(), options: jsonValueSchema.optional() }).strict()),
    execution: z.object({ maxStates: z.number().int().positive() }).strict(),
    scanPolicy: z.enum(["refresh", "current", "error"]),
  }).strict(),
  engines: z.array(z.object({ id: z.string(), version: z.string(), capabilities: z.array(z.string()) }).strict()),
  diagnostics: z.array(diagnosticSchema),
  standards: z.array(z.object({ standard: z.string(), components: z.array(componentSchema) }).strict()),
  summary: summarySchema,
}).strict();

export type SurveyRunV1 = z.infer<typeof surveyRunV1Schema>;
export type SurveyDiagnosticV1 = SurveyRunV1["diagnostics"][number];
export type SurveyTargetingSnapshotV1 = SurveyRunV1["targeting"];
export type SurveyConfigSnapshotV1 = SurveyRunV1["config"];
export type SurveyProjectSnapshotV1 = SurveyRunV1["project"];
export type SurveyGitSnapshotV1 = NonNullable<SurveyRunV1["git"]>;

export function parseSurveyRun(value: unknown): SurveyRunV1 {
  return surveyRunV1Schema.parse(value);
}
