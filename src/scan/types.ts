import type { CanonicalComponentModel } from "../types/component-scan.js";
import type { SurveyScanPolicy } from "../schemas/survey.js";

export interface ScanDelta {
  readonly new: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
}

export type ScanStaleReason = "files-changed" | "fingerprint-changed";

export type ScanFreshness =
  | { readonly kind: "missing" }
  | { readonly kind: "fresh"; readonly model: CanonicalComponentModel; readonly fingerprint: string }
  | { readonly kind: "stale"; readonly model: CanonicalComponentModel; readonly fingerprint: string; readonly reason: ScanStaleReason }
  | { readonly kind: "invalid"; readonly reason: "corrupt" | "incompatible" };

export interface ScanResult {
  readonly model: CanonicalComponentModel;
  readonly fingerprint: string;
  readonly freshness: ScanFreshness["kind"];
  readonly refreshed: boolean;
  readonly delta: ScanDelta;
  readonly diagnostics: readonly string[];
}

export interface ResolvedSurveyScan {
  readonly model: CanonicalComponentModel;
  readonly fingerprint: string;
  readonly wasStale: boolean;
  readonly refreshed: boolean;
  readonly diagnostics: readonly string[];
}

export interface ApplyScanPolicyOptions {
  readonly policy: SurveyScanPolicy;
  readonly root: string;
  readonly sourceDirectory: string;
  readonly ignorePatterns: readonly string[];
}
