import type { RawDynamicRoute, RawStaticRoute } from "./route.js";

/**
 * Immutable route view inside the execution plan: an independent copy of the
 * original configured route, never an alias to `config.routes` (RFC-008,
 * review follow-up). The plan must remain a frozen snapshot even if the
 * loaded configuration is modified later.
 */
export type PlannedRouteSnapshot =
  | Readonly<RawStaticRoute>
  | (Readonly<Omit<RawDynamicRoute, "parameters">> & {
      readonly parameters: Readonly<Record<string, string>>;
    });

/** Route resolved inside a run, with its effective user (RFC-008). */
export interface PlannedRoute {
  readonly route: PlannedRouteSnapshot;
  /** `undefined` means a public capture with no authentication. */
  readonly user: string | undefined;
}

/** Resolved run, with routes in the exact `run.routes` order. */
export interface PlannedRun {
  readonly runName: string;
  readonly order: number;
  readonly routes: readonly PlannedRoute[];
}

/**
 * Typed execution plan (RFC-008): runs sorted by `order` (ties keep file
 * order), built before any browser is opened.
 */
export type ExecutionPlan = readonly PlannedRun[];
