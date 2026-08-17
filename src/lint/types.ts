import type { Severity } from "../schemas/rules.js";
import type { PropValueSource, UnresolvedProp } from "../state-planning/types.js";

/**
 * The structured `lantern lint` result model (RFC-007).
 *
 * Terminal text is rendered from this structure; it is never the source of
 * truth. The model is deliberately engine-agnostic: RFC-008 attaches real
 * normalized checks by populating {@link StateReport.checks} without any
 * redesign of the surrounding shape (standard → component → state → check).
 */

/** The outcome of one executed check: independent from its configured severity. */
export type CheckStatus = "pass" | "fail" | "review";

export type RunStatus = "running" | "completed" | "failed" | "cancelled";

export type OutcomeReason =
  | "unsupported"
  | "unavailable"
  | "inconclusive"
  | "manual-review"
  | "not-applicable"
  | "skipped"
  | "partial-analysis"
  | "operational-error";

export interface SourceLocation {
  readonly file: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly endLine?: number | undefined;
  readonly endColumn?: number | undefined;
}

export type EvidenceValue = string | number | boolean | null | readonly EvidenceValue[] | { readonly [key: string]: EvidenceValue };

export type EvidenceRecord =
  | { readonly kind: "observation"; readonly name: string; readonly value: EvidenceValue }
  | { readonly kind: "expectation"; readonly expected: string; readonly observed: string }
  | { readonly kind: "element"; readonly selector?: string | undefined; readonly html?: string | undefined }
  | { readonly kind: "attribute"; readonly name: string; readonly value: EvidenceValue }
  | { readonly kind: "source"; readonly location: SourceLocation }
  | { readonly kind: "capability"; readonly required: string; readonly attempts: readonly { readonly engine: string; readonly reason: string }[] };

/** Aggregate status at state/component level; adds `skipped` for planning outcomes. */
export type ReportStatus = CheckStatus | "skipped";

/** Where a generated state's props were sourced from, surfaced for `--verbose`. */
export type StatePropProvenance = Readonly<Record<string, PropValueSource>>;

/**
 * One normalized accessibility check result. RFC-007 defines this shape but
 * never populates it — no check provider exists until RFC-008. Nothing here
 * is coupled to axe, Lighthouse, or any other concrete engine.
 */
export interface CheckResult {
  readonly checkId: string;
  readonly componentId: string;
  readonly stateId: string;
  /** Lantern-owned rule id, e.g. `lantern/accessible-name`. */
  readonly ruleId: string;
  /** Configured severity for this rule (`off` never reaches this model). */
  readonly severity: Exclude<Severity, "off">;
  readonly status: CheckStatus;
  readonly message?: string | undefined;
  readonly location?: SourceLocation | undefined;
  /** Runtime/engine provenance, when a concrete engine produced this result. */
  readonly engine?:
    | { readonly name: string; readonly version?: string | undefined; readonly nativeRuleId?: string | undefined }
    | undefined;
  /** Why a `review` (or otherwise inconclusive) status was produced. */
  readonly outcomeReason?: OutcomeReason | undefined;
  readonly reason?: string | undefined;
  readonly evidence: readonly EvidenceRecord[];
  readonly durationMs: number;
}

/** One generated, independently reportable component state (RFC-006). */
export interface StateReport {
  readonly componentId: string;
  readonly stateId: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly propProvenance: StatePropProvenance;
  /** Empty when no provider ran or when an available provider finds no checks. */
  readonly checks: readonly CheckResult[];
  /** `"review"` whenever `checks` is empty: nothing was actually verified. */
  readonly status: ReportStatus;
  readonly outcomeReason?: OutcomeReason | undefined;
  /** Producer-authored explanation of an aggregate state outcome. */
  readonly reason?: string | undefined;
}

export interface StateDimensionReport {
  readonly name: string;
  readonly values: readonly unknown[];
  readonly source: PropValueSource;
}

/** The state-planning outcome for one component (RFC-006), carried through untouched. */
export type PlanStatus = "ready" | "unresolved" | "skipped";

/** One component's report within a single standard's evaluation context. */
export interface ComponentReport {
  readonly componentId: string;
  readonly component: string;
  readonly source: string;
  readonly planStatus: PlanStatus;
  /** Aggregate report status; `unresolved` and explicit `skip` both report as `"skipped"`. */
  readonly status: ReportStatus;
  readonly outcomeReason?: OutcomeReason | undefined;
  readonly states: readonly StateReport[];
  readonly dimensions?: readonly StateDimensionReport[] | undefined;
  readonly unresolvedProps?: readonly UnresolvedProp[] | undefined;
  /** Human-readable reason for a `"skipped"` status (explicit skip or unresolved detail). */
  readonly reason?: string | undefined;
  readonly truncated: boolean;
  readonly totalPossibleStates: number;
  readonly maxStates: number;
}

/** One configured standard's evaluation context (RFC-005) — never merged with another. */
export interface StandardReport {
  readonly standard: string;
  readonly components: readonly ComponentReport[];
}

/**
 * Aggregate counts over component state-planning outcomes (RFC-006/007) —
 * explicitly standard-independent, not a per-standard evaluation summary. It
 * reflects the single planning pass shared by every configured standard in
 * {@link LintReport.standards} (no standard-aware check provider exists yet —
 * RFC-008), never "the first configured standard's results".
 */
export interface LintSummary {
  readonly componentsPass: number;
  readonly componentsFail: number;
  readonly componentsReview: number;
  readonly componentsSkipped: number;
  readonly checksPass: number;
  readonly checksFail: number;
  readonly checksReview: number;
  readonly durationMs: number;
}

/** How `lantern lint` selected which components to include (RFC-007). */
export type LintTargetMode =
  | { readonly kind: "incremental" }
  | { readonly kind: "all" }
  | { readonly kind: "since"; readonly ref: string }
  | { readonly kind: "path"; readonly path: string };

export interface LintTargetingInfo {
  readonly mode: LintTargetMode;
  /** Whether discovery was actually rescanned, or a valid cache was reused. */
  readonly rescanned: boolean;
  readonly selection?: LintTargetSelectionInfo | undefined;
}

export type LintTargetSelectionInfo =
  | { readonly kind: "all" }
  | { readonly kind: "none"; readonly reason?: string | undefined }
  | { readonly kind: "affected"; readonly componentCount: number }
  | {
      readonly kind: "path";
      readonly path: string;
      readonly pathKind: "file" | "directory";
      readonly componentCount: number;
    }
  | { readonly kind: "fallback"; readonly reason: string; readonly details?: readonly string[] | undefined };

export interface LintDiagnostic {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly scope: "run" | "component" | "state" | "check" | "engine";
  readonly source: string;
  readonly component?: string | undefined;
  readonly componentId?: string | undefined;
  readonly stateId?: string | undefined;
  readonly checkId?: string | undefined;
  readonly engine?: { readonly name: string; readonly version?: string | undefined } | undefined;
  readonly message: string;
}

export type ProviderStatus =
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "available"; readonly provider: string };

/** The full structured `lantern lint` result (RFC-007). */
export interface LintReport {
  readonly version: 3;
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: Exclude<RunStatus, "running">;
  readonly generatedAt: string;
  readonly targeting: LintTargetingInfo;
  readonly provider?: ProviderStatus | undefined;
  readonly engines: readonly { readonly id: string; readonly version: string; readonly capabilities: readonly string[] }[];
  readonly config: {
    readonly standards: readonly string[];
    readonly rules: Readonly<Record<string, string>>;
  };
  readonly diagnostics?: readonly LintDiagnostic[] | undefined;
  readonly standards: readonly StandardReport[];
  readonly summary: LintSummary;
}
