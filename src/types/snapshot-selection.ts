/**
 * Execution scope requested by the CLI (RFC-010):
 * - `all`: every run plus standalone routes (default behavior, no option);
 * - `run`: a single run (`--runName`); in V1, `--partial` adds no extra
 *   effect because a run already captures only the routes it explicitly
 *   references and enables;
 * - `route`: a single route outside any run (`--route`, with optional `--user`);
 * - `run-route`: one route inside a specific run (`--runName` + `--route`).
 */
export type SnapshotSelection =
  | { readonly kind: "all" }
  | { readonly kind: "run"; readonly runName: string }
  | { readonly kind: "route"; readonly routePath: string; readonly user: string | undefined }
  | { readonly kind: "run-route"; readonly runName: string; readonly routePath: string };
