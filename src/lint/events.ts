import type { CheckResult, ComponentReport, LintDiagnostic, LintReport, StateReport } from "./types.js";

type RunRef = { readonly runId: string; readonly timestamp: string };
export type AuditEvent =
  | (RunRef & { readonly type: "run-started" })
  | (RunRef & { readonly type: "component-started"; readonly componentId: string })
  | (RunRef & { readonly type: "state-started"; readonly componentId: string; readonly stateId: string })
  | (RunRef & { readonly type: "check-started"; readonly componentId: string; readonly stateId: string; readonly checkId: string; readonly ruleId: string })
  | (RunRef & { readonly type: "check-completed"; readonly result: CheckResult })
  | (RunRef & { readonly type: "state-completed"; readonly state: StateReport })
  | (RunRef & { readonly type: "component-completed"; readonly component: ComponentReport })
  | (RunRef & { readonly type: "diagnostic"; readonly diagnostic: LintDiagnostic })
  | (RunRef & { readonly type: "run-completed"; readonly report: LintReport })
  | (RunRef & { readonly type: "run-failed"; readonly report: LintReport })
  | (RunRef & { readonly type: "run-cancelled"; readonly report: LintReport });

export type AuditEventSink = (event: AuditEvent) => void | Promise<void>;

export class AuditCancelledError extends Error {
  constructor() { super("Audit cancelled."); this.name = "AuditCancelledError"; }
}

export function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new AuditCancelledError();
}
