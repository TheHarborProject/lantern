export type ComponentExportKind = "named" | "default";
export type ComponentAnalysisStatus = "complete" | "partial";

/**
 * Whether a prop is authored by the component itself or resolved from an
 * inherited/intersected type (React, the DOM lib, a design-system helper…).
 */
export type PropOrigin = "declared" | "inherited";

export interface ComponentAnalysis {
  readonly status: ComponentAnalysisStatus;
  readonly diagnostics: readonly string[];
}

export interface ComponentScanDiagnostic {
  readonly source: string;
  readonly exportName: string;
  readonly message: string;
}

/**
 * A prop as recorded in the canonical model: exhaustive, including inherited
 * DOM/React props, each tagged with enough provenance to tell where it came
 * from.
 */
export interface ResolvedComponentProp {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly origin: PropOrigin;
  /** Portable location of the declaration (project path or library hint). */
  readonly provenance: string;
}

/** Statically observed rendering facts used by derived projections. */
export interface ComponentRendering {
  /** Sorted, unique lowercase intrinsic (native HTML) elements rendered. */
  readonly intrinsicElements: readonly string[];
  /** Whether native semantics could be determined by static analysis. */
  readonly analyzable: boolean;
}

/** One component in the single canonical, exhaustive internal model. */
export interface CanonicalComponent {
  readonly id: string;
  readonly source: string;
  readonly exportName: string;
  readonly name: string;
  readonly exportKind: ComponentExportKind;
  readonly props: readonly ResolvedComponentProp[];
  readonly rendering: ComponentRendering;
  readonly analysis: ComponentAnalysis;
}

/**
 * The canonical component-discovery model. Every projection (human,
 * accessibility) is derived from this single model — sources are never scanned
 * independently per view.
 */
export interface CanonicalComponentModel {
  readonly version: 1;
  readonly components: readonly CanonicalComponent[];
  readonly diagnostics: readonly ComponentScanDiagnostic[];
}

/** Concise prop shape for the human-readable projection. */
export interface ComponentProp {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
}

/** A component as presented in the concise, human-readable projection. */
export interface DiscoveredComponent {
  readonly id: string;
  readonly source: string;
  readonly exportName: string;
  readonly name: string;
  readonly exportKind: ComponentExportKind;
  readonly props: readonly ComponentProp[];
  readonly analysis: ComponentAnalysis;
}

/** The human-readable projection written to `.lantern/scan.json`. */
export interface ComponentScanIndex {
  readonly version: 1;
  readonly components: readonly DiscoveredComponent[];
  readonly diagnostics: readonly ComponentScanDiagnostic[];
}

/**
 * Accessibility-oriented facts derived from the canonical model. This projection
 * describes the target component; it deliberately encodes no rule catalog or
 * behavior specific to any concrete accessibility engine.
 */
export interface AccessibilityComponent {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly semantics: {
    /** Native HTML elements the component renders, if statically known. */
    readonly nativeElements: readonly string[];
    /** Whether semantics could be derived from a native element. */
    readonly derived: boolean;
  };
  readonly interactivity: {
    /** Whether a rendered element or a prop makes the component focusable. */
    readonly focusable: boolean;
    /** Interaction-relevant event handler props exposed by the component. */
    readonly handlers: readonly string[];
  };
  /** Props that can contribute to the accessible name. */
  readonly accessibleNameSources: readonly string[];
  /** `aria-*` and `role` props present on the component surface. */
  readonly ariaProps: readonly string[];
  /** Accessibility-relevant state props (disabled, checked, expanded…). */
  readonly stateProps: readonly string[];
  /** Whether rendered/runtime analysis may be required to complete the picture. */
  readonly runtimeAnalysisRequired: boolean;
}

/** The accessibility projection written to `.lantern/accessibility.json`. */
export interface AccessibilityIndex {
  readonly version: 1;
  readonly components: readonly AccessibilityComponent[];
}

/**
 * Internal, generated change-detection metadata written to
 * `.lantern/cache/scan-state.json` (RFC-007). Used only to decide whether
 * `lantern lint`'s default incremental targeting can safely reuse the cached
 * canonical component model instead of rescanning. Never a place for durable
 * user decisions — those live in `lantern.config.json`.
 */
export interface ScanStateCache {
  readonly version: 1;
  /** Portable, project-relative source path → content hash, as of the last successful scan. */
  readonly sourceHashes: Readonly<Record<string, string>>;
}
