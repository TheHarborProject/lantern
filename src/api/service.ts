import { loadConfig } from "../config/load-config.js";
import { resolveLintTargets } from "../lint/resolve-lint-targets.js";
import { buildLintReport, type BuildLintReportOptions } from "../lint/build-lint-report.js";
import type { LintTargetMode } from "../lint/types.js";
import { toAuditWireDto } from "./wire.js";
import type { ResolvedConfig } from "../types/config.js";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import type { AuditWireDto } from "./wire.js";
import type { LintReport } from "../lint/types.js";

export interface ProjectRequest { readonly cwd?: string; readonly configPath?: string }
export interface AuditRequest extends ProjectRequest {
  readonly mode?: LintTargetMode;
  readonly selection?: { readonly componentIds?: readonly string[]; readonly stateIds?: readonly string[]; readonly checkIds?: readonly string[] };
  readonly signal?: AbortSignal;
  readonly events?: BuildLintReportOptions["events"];
}

export function resolveProject(request: ProjectRequest = {}): ResolvedConfig {
  return loadConfig({ cwd: request.cwd ?? process.cwd(), ...(request.configPath === undefined ? {} : { explicitPath: request.configPath }) });
}

export function discoverComponents(request: ProjectRequest = {}): CanonicalComponentModel {
  const config = resolveProject(request);
  return resolveLintTargets({ root: config.project.root, cwd: request.cwd, ignorePatterns: config.ignorePatterns, mode: { kind: "incremental" } }).model;
}

export async function runAudit(request: AuditRequest = {}): Promise<{ readonly report: LintReport; readonly wire: AuditWireDto }> {
  const config = resolveProject(request);
  const report = await buildLintReport({
    config, mode: request.mode ?? { kind: "incremental" },
    ...(request.cwd === undefined ? {} : { cwd: request.cwd }),
    ...(request.selection?.componentIds === undefined ? {} : { componentIds: request.selection.componentIds }),
    ...(request.selection?.stateIds === undefined ? {} : { stateIds: request.selection.stateIds }),
    ...(request.selection?.checkIds === undefined ? {} : { checkIds: request.selection.checkIds }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
    ...(request.events === undefined ? {} : { events: request.events }),
  });
  return { report, wire: toAuditWireDto(report) };
}
