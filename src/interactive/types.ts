import type { ResolvedSurveyScan, ScanDelta } from "../scan/types.js";

export interface SelectableState {
  readonly id: string;
  readonly label: string;
}

export interface SelectableComponent {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly states: readonly SelectableState[];
}

export type InteractiveStateSelection =
  | { readonly kind: "all" }
  | { readonly kind: "restricted"; readonly ids: readonly string[] };

export interface InteractiveSurveySelection {
  readonly componentIds: readonly string[];
  readonly states: InteractiveStateSelection;
}

export interface InteractiveDefaults {
  readonly selection: InteractiveSurveySelection;
  readonly notes: readonly string[];
}

export interface ResolvedInteractiveScan {
  readonly scan: ResolvedSurveyScan;
  readonly delta: ScanDelta;
  readonly effectivePolicy: "refresh" | "current" | "error";
  readonly notes: readonly string[];
}

export type StaleScanChoice = "refresh" | "current" | "cancel";
export type PlanChoice = "start" | "back" | "cancel";

export interface InteractiveSurveyPrompter {
  chooseStaleScan(reason: string): Promise<StaleScanChoice>;
  chooseComponents(components: readonly SelectableComponent[], selectedIds: readonly string[], notes: readonly string[]): Promise<readonly string[] | null>;
  refineStates(components: readonly SelectableComponent[], selection: InteractiveSurveySelection): Promise<InteractiveSurveySelection | null>;
  confirmPlan(plan: { readonly selectedComponents: number; readonly totalComponents: number; readonly selectedStates: number; readonly standards: readonly string[]; readonly save: boolean }): Promise<PlanChoice>;
}
