import type { ComponentRuntime } from "../component-runtime/types.js";
import type { CheckResult } from "../lint/types.js";
import type { Severity } from "../schemas/rules.js";
import type { AccessibilityComponent } from "../types/component-scan.js";

/**
 * The engine boundary (RFC-008): the evidence class a planned check needs in
 * order to be evaluated. New engines add new capabilities; nothing outside
 * `src/engines` needs to branch on which concrete engine is involved.
 */
export type EngineCapability = "static-evidence" | "rendered-dom";

/**
 * One engine-independent unit of work between a resolved Lantern rule and a
 * concrete engine (RFC-008). Planning (see `plan-checks.ts`) produces these
 * deterministically, without knowing which engine — if any — will end up
 * executing them.
 */
export interface PlannedCheck {
  readonly checkId: string;
  readonly ruleId: string;
  readonly severity: Exclude<Severity, "off">;
  readonly componentId: string;
  readonly component: string;
  /** Project-relative source path (portable, matches `CanonicalComponent.source`). */
  readonly source: string;
  readonly requiredCapability: EngineCapability;
  /** Present whenever the check is scoped to one generated state. */
  readonly stateId: string;
  readonly stateProps?: Readonly<Record<string, unknown>> | undefined;
  /** Static/accessibility projection evidence already known for this component. */
  readonly accessibility: AccessibilityComponent;
}

export type SupportResult =
  | { readonly kind: "supported" }
  | { readonly kind: "unsupported"; readonly reason: string };

export interface EngineIdentity {
  readonly id: string;
  readonly version: string;
}

/** Runtime handles an engine's `execute` may need; absent when not applicable. */
export interface EngineExecutionContext {
  /** A reused, already-bundled component runtime (RFC-007.5) for rendered checks. */
  readonly runtime?: ComponentRuntime | undefined;
}

/**
 * The stable engine contract (RFC-008). An engine identifies itself, declares
 * what it can evaluate, and returns normalized results — it never becomes the
 * public rule API (see `ruleId` on {@link PlannedCheck}, always Lantern-owned).
 */
export interface Engine {
  readonly identity: EngineIdentity;
  readonly capabilities: readonly EngineCapability[];
  /** Deterministic: same planned check and engine state always answer the same way. */
  supports(check: PlannedCheck): SupportResult;
  execute(check: PlannedCheck, context: EngineExecutionContext): Promise<CheckResult>;
}
