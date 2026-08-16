/**
 * State-planning types (RFC-006): the shapes produced while turning a
 * discovered component into executable prop combinations. These are pure data
 * — nothing here touches the isolated runtime or a browser.
 */

/** Where a prop's resolved value set came from. */
export type PropValueSource = "explicit" | "fixture" | "inferred";

/** A single prop's resolved, ordered value set and where it came from. */
export interface ResolvedPropValues {
  readonly name: string;
  readonly required: boolean;
  readonly source: PropValueSource;
  readonly values: readonly unknown[];
}

/** A required prop that could not be resolved from configuration or safe inference. */
export interface UnresolvedProp {
  readonly name: string;
  readonly type: string;
  readonly reason: string;
}

/** One generated, renderable prop combination for a component. */
export interface GeneratedState {
  /** Stable, content-derived identity (same component + props ⇒ same id). */
  readonly id: string;
  readonly component: string;
  readonly componentId: string;
  readonly props: Readonly<Record<string, unknown>>;
}

interface ComponentStatePlanBase {
  readonly component: string;
  readonly componentId: string;
}

/** The component was explicitly opted out of state generation (`components.<name>.skip`). */
export interface SkippedComponentStatePlan extends ComponentStatePlanBase {
  readonly status: "skipped";
}

/** At least one required prop could not be resolved; no states were generated. */
export interface UnresolvedComponentStatePlan extends ComponentStatePlanBase {
  readonly status: "unresolved";
  readonly unresolvedProps: readonly UnresolvedProp[];
}

/** States were generated, deterministically and possibly truncated. */
export interface ReadyComponentStatePlan extends ComponentStatePlanBase {
  readonly status: "ready";
  /** Resolved props that participate in the plan, in stable order. */
  readonly dimensions: readonly ResolvedPropValues[];
  readonly states: readonly GeneratedState[];
  /** The full Cartesian product size before bounding/truncation. */
  readonly totalPossibleStates: number;
  /** True when `states.length < totalPossibleStates`. */
  readonly truncated: boolean;
  readonly maxStates: number;
}

export type ComponentStatePlan =
  | SkippedComponentStatePlan
  | UnresolvedComponentStatePlan
  | ReadyComponentStatePlan;
