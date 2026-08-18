import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, relative, sep } from "node:path";
import { buildLintReport, type BuildLintReportOptions } from "../lint/build-lint-report.js";
import { resolveSelectionFromModel } from "../lint/resolve-lint-targets.js";
import type { AuditEvent } from "../lint/events.js";
import type { LintTargetMode } from "../lint/types.js";
import { applySurveyScanPolicy, inspectScanState } from "../scan/scan-service.js";
import type { ResolvedConfig } from "../types/config.js";
import type { SurveyScanPolicy } from "../schemas/survey.js";
import { DEFAULT_MAX_STATES } from "../state-planning/plan-component-state.js";
import { SurveyCancelledError } from "./events.js";
import { jsonValueSchema, parseSurveyRun, type SurveyConfigSnapshotV1, type SurveyGitSnapshotV1, type SurveyRunV1 } from "./schema/survey-run.js";
import type { SurveyEvent, SurveyEventSink } from "./events.js";

export type SurveySelectionRequest =
  | { readonly kind: "all" }
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "since"; readonly ref: string }
  | { readonly kind: "programmatic"; readonly componentIds: readonly string[]; readonly stateIds?: readonly string[]; readonly checkIds?: readonly string[] };

export interface RunSurveyOptions {
  readonly config: ResolvedConfig;
  readonly selection?: SurveySelectionRequest;
  readonly name?: string;
  readonly maxStates?: number;
  readonly cwd?: string;
  readonly signal?: AbortSignal;
  readonly events?: SurveyEventSink;
  readonly mountTimeoutMs?: number;
  readonly bundle?: BuildLintReportOptions["bundle"];
  readonly launch?: BuildLintReportOptions["launch"];
}

export async function runSurvey(options: RunSurveyOptions): Promise<SurveyRunV1> {
  if (options.signal?.aborted === true) throw new SurveyCancelledError();
  const selection = options.selection ?? { kind: "all" };
  const config = options.config;
  const scanPolicy = config.survey.scan.nonInteractive;
  const scanOptions = { root: config.project.root, sourceDirectory: config.project.sourceDirectory, ignorePatterns: config.ignorePatterns };
  const scan = applySurveyScanPolicy(inspectScanState(scanOptions), { ...scanOptions, policy: scanPolicy });
  const mode = toLintMode(selection);
  const resolvedSelection = resolveSelectionFromModel({
    model: scan.model, root: config.project.root, sourceDirectory: config.project.sourceDirectory,
    cwd: options.cwd, ignorePatterns: config.ignorePatterns, mode,
  });
  const explicitIds = selection.kind === "programmatic"
    ? validateIds(selection.componentIds, scan.model.components.map(({ id }) => id), "component")
    : [...(resolvedSelection.targetComponentIds ?? new Set(scan.model.components.map(({ id }) => id)))].sort();
  const stateIds = selection.kind === "programmatic" ? selection.stateIds : undefined;
  const checkIds = selection.kind === "programmatic" ? selection.checkIds : undefined;
  const configSnapshot = createConfigSnapshot(config, scanPolicy, options.maxStates ?? DEFAULT_MAX_STATES);
  const git = config.survey.git.capture ? captureGit(config.project.root) : undefined;
  const project = projectSnapshot(config, scan.model.components.map(({ id }) => id));
  const bridge = options.events === undefined ? undefined : createEventBridge(options.events);
  const report = await buildLintReport({
    config, mode, cwd: options.cwd, maxStates: options.maxStates,
    componentIds: explicitIds, stateIds, checkIds, signal: options.signal, events: bridge,
    mountTimeoutMs: options.mountTimeoutMs, bundle: options.bundle, launch: options.launch,
    preparedTargets: {
      model: scan.model,
      rescanned: scan.refreshed,
      targetComponentIds: new Set(explicitIds),
      selection: resolvedSelection.selection,
    },
  });
  const diagnostics = [
    ...scan.diagnostics.map((message) => ({ code: "STALE_SCAN", severity: "warning" as const, scope: "run" as const, source: ".lantern/scan.json", message })),
    ...(report.diagnostics ?? []).map((diagnostic) => diagnostic.code === "AUDIT_CANCELLED" ? { ...diagnostic, code: "SURVEY_CANCELLED", message: diagnostic.message.replace("Audit", "Survey") } : diagnostic),
  ];
  const targeting = {
    source: selection.kind,
    ...(selection.kind === "path" ? { path: portablePath(relative(config.project.root, resolveTargetPath(options.cwd ?? config.project.root, selection.path))) } : {}),
    ...(selection.kind === "since" ? { ref: selection.ref } : {}),
    componentIds: explicitIds,
    ...(stateIds === undefined ? {} : { stateIds: [...stateIds].sort() }),
    scan: { fingerprint: scan.fingerprint, wasStale: scan.wasStale, refreshed: scan.refreshed },
  };
  const run = parseSurveyRun({
    schema: "lantern-survey-run", version: 1, id: report.runId,
    ...(options.name === undefined ? {} : { name: options.name }),
    startedAt: report.startedAt, finishedAt: report.finishedAt, status: report.status,
    project, ...(git === undefined ? {} : { git }), targeting, config: configSnapshot,
    engines: report.engines, diagnostics, standards: report.standards, summary: report.summary,
  });
  await emitTerminal(options.events, run);
  return run;
}

function toLintMode(selection: SurveySelectionRequest): LintTargetMode {
  if (selection.kind === "path") return { kind: "path", path: selection.path };
  if (selection.kind === "since") return { kind: "since", ref: selection.ref };
  return { kind: "all" };
}

function validateIds(requested: readonly string[], available: readonly string[], label: string): string[] {
  const known = new Set(available);
  const result = [...new Set(requested)].sort();
  const unknown = result.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`Unknown ${label} selection: ${unknown.join(", ")}`);
  return result;
}

function createConfigSnapshot(config: ResolvedConfig, scanPolicy: SurveyScanPolicy, maxStates: number): SurveyConfigSnapshotV1 {
  const rules = Object.fromEntries(Object.entries(config.rules).sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) => {
    const severity = Array.isArray(value) ? value[0] : value;
    return [id, Array.isArray(value) ? { severity, options: jsonValueSchema.parse(value[1]) } : { severity }];
  }));
  const engines = Object.fromEntries(Object.entries(config.engines).sort(([a], [b]) => a.localeCompare(b)).map(([id, enabled]) => [id, { enabled }]));
  const semantic = { schemaVersion: 1 as const, standards: [...config.standards].sort(), rules, engines, execution: { maxStates }, scanPolicy };
  return { ...semantic, fingerprint: sha256(stableJson(semantic)) };
}

function captureGit(root: string): SurveyGitSnapshotV1 | undefined {
  try {
    const commit = git(root, ["rev-parse", "HEAD"]);
    const branchValue = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"], true);
    const dirty = git(root, ["status", "--porcelain", "--untracked-files=normal"]).length > 0;
    return { ...(commit === "" ? {} : { commit }), ...(branchValue === "" ? {} : { branch: branchValue }), dirty };
  } catch { return undefined; }
}

function projectSnapshot(config: ResolvedConfig, componentIds: readonly string[]): { fingerprint: string; name?: string } {
  const remote = git(config.project.root, ["config", "--get", "remote.origin.url"], true);
  const packageName = readPackageName(config.project.root);
  const fallback = stableJson({
    configName: basename(config.configFilePath),
    sourceDirectory: portablePath(relative(config.project.root, config.project.sourceDirectory)),
    packageName,
    componentIds: [...componentIds].sort(),
  });
  const identity = remote !== "" ? normalizeRemote(remote) : fallback;
  return { fingerprint: sha256(identity), ...(packageName === undefined ? {} : { name: packageName }) };
}

function readPackageName(root: string): string | undefined {
  try { const value = JSON.parse(readFileSync(`${root}/package.json`, "utf8")) as { name?: unknown }; return typeof value.name === "string" ? value.name : undefined; }
  catch { return undefined; }
}

function git(root: string, args: readonly string[], tolerate = false): string {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch (error) { if (tolerate) return ""; throw error; }
}

function normalizeRemote(value: string): string {
  return value.replace(/^[^@/]+@/, "").replace(/^https?:\/\/[^@/]+@/, "https://").replace(/\.git$/, "").toLowerCase();
}

function createEventBridge(sink: SurveyEventSink): (event: AuditEvent) => Promise<void> {
  return async (event) => {
    if (event.type === "run-completed" || event.type === "run-failed" || event.type === "run-cancelled") return;
    const type = event.type === "run-started" ? "survey-started" : event.type === "run-planned" ? "survey-planned" : event.type;
    await sink({ ...event, type } as SurveyEvent);
  };
}

async function emitTerminal(sink: SurveyEventSink | undefined, run: SurveyRunV1): Promise<void> {
  if (sink === undefined) return;
  const type = run.status === "completed" ? "survey-completed" : run.status === "failed" ? "survey-failed" : "survey-cancelled";
  await sink({ type, runId: run.id, timestamp: run.finishedAt, run });
}

function resolveTargetPath(cwd: string, path: string): string {
  return new URL(path, `file://${cwd.endsWith("/") ? cwd : `${cwd}/`}`).pathname;
}

function portablePath(value: string): string { return value.split(sep).join("/"); }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
