export interface ComponentProp {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
}

export type ComponentExportKind = "named" | "default";
export type ComponentAnalysisStatus = "complete" | "partial";

export interface DiscoveredComponent {
  readonly id: string;
  readonly source: string;
  readonly exportName: string;
  readonly name: string;
  readonly exportKind: ComponentExportKind;
  readonly props: readonly ComponentProp[];
  readonly analysis: {
    readonly status: ComponentAnalysisStatus;
    readonly diagnostics: readonly string[];
  };
}

export interface ComponentScanDiagnostic {
  readonly source: string;
  readonly exportName: string;
  readonly message: string;
}

export interface ComponentScanIndex {
  readonly version: 1;
  readonly components: readonly DiscoveredComponent[];
  readonly diagnostics: readonly ComponentScanDiagnostic[];
}
