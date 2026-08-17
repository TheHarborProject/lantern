import { z } from "zod";
import type { LintReport } from "../lint/types.js";

const jsonValue: z.ZodType<unknown> = z.lazy(() => z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]));

/** External contract version, intentionally independent from the domain report version. */
export const auditWireSchema = z.object({
  version: z.literal(1),
  run: z.object({
    id: z.string(), startedAt: z.string(), finishedAt: z.string(), status: z.enum(["completed", "failed", "cancelled"]), durationMs: z.number().nonnegative(),
  }),
  targeting: jsonValue,
  engines: z.array(jsonValue),
  config: jsonValue,
  diagnostics: z.array(jsonValue),
  standards: z.array(jsonValue),
  summary: jsonValue,
});

export type AuditWireDto = z.infer<typeof auditWireSchema>;

/** Explicit domain-to-wire conversion: no runtime/domain objects cross this boundary. */
export function toAuditWireDto(report: LintReport): AuditWireDto {
  const dto = {
    version: 1 as const,
    run: { id: report.runId, startedAt: report.startedAt, finishedAt: report.finishedAt, status: report.status, durationMs: report.summary.durationMs },
    targeting: cloneJson(report.targeting),
    engines: cloneJson(report.engines),
    config: cloneJson(report.config),
    diagnostics: cloneJson(report.diagnostics ?? []),
    standards: cloneJson(report.standards),
    summary: cloneJson(report.summary),
  };
  return auditWireSchema.parse(dto);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
