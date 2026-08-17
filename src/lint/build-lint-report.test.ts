import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, Page } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configSchema } from "../schemas/config.js";
import { resolveConfigPaths } from "../config/resolve-config-paths.js";
import type { ResolvedConfig } from "../types/config.js";
import { buildLintReport } from "./build-lint-report.js";

function resolvedConfig(root: string, overrides: Record<string, unknown> = {}): ResolvedConfig {
  const raw = configSchema.parse({ project: { root: "." }, ...overrides });
  return resolveConfigPaths(raw, join(root, "lantern.config.json"));
}

interface KeyboardAccessProbeResult {
  readonly usableInteractiveCount: number;
  readonly enabledInteractiveCount: number;
  readonly tabbableCount: number;
  readonly disabledInteractiveCount: number;
}

/**
 * A fake isolation page reused across the rendered-engine tests below: each
 * `runtime.render()` call issues three `page.evaluate` calls in order (inject
 * props, check for a mount error, then the rendered engine's own focus
 * probe) — mirrors the fake used in `component-runtime/runtime-session.test.ts`.
 */
function fakeRenderPage(probes: readonly KeyboardAccessProbeResult[]): {
  readonly page: Page;
  readonly evaluate: ReturnType<typeof vi.fn>;
} {
  const evaluate = vi.fn();
  for (const probe of probes) {
    evaluate
      .mockImplementationOnce(() => Promise.resolve(undefined))
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementationOnce(() => Promise.resolve(probe));
  }
  const page = {
    setContent: vi.fn(() => Promise.resolve(undefined)),
    evaluate,
    addScriptTag: vi.fn(() => Promise.resolve(null)),
    waitForFunction: vi.fn(() => Promise.resolve(null)),
    close: vi.fn(() => Promise.resolve(undefined)),
  } as unknown as Page;
  return { page, evaluate };
}

describe("buildLintReport", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lantern-build-lint-report-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("reports a ready component with review status and no fabricated checks", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );

    const report = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    expect(report).toMatchObject({ version: 3, status: "completed" });
    expect(report.runId).not.toBe("");
    expect(Date.parse(report.finishedAt)).toBeGreaterThanOrEqual(Date.parse(report.startedAt));
    expect(report.engines.map((engine) => engine.id)).toEqual(["lantern-static", "lantern-rendered-dom"]);

    expect(report.standards).toHaveLength(1);
    const button = report.standards[0]?.components[0];
    expect(button?.component).toBe("Button");
    expect(button?.planStatus).toBe("ready");
    expect(button?.status).toBe("review");
    expect(button?.states.length).toBeGreaterThan(0);
    for (const state of button?.states ?? []) {
      expect(state.checks).toEqual([]);
      expect(state.status).toBe("review");
    }
  });

  it("reports an unresolved component as skipped with a truthful reason", async () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    const avatar = report.standards[0]?.components[0];
    expect(avatar?.planStatus).toBe("unresolved");
    expect(avatar?.status).toBe("skipped");
    expect(avatar?.states).toEqual([]);
    expect(avatar?.unresolvedProps?.[0]?.name).toBe("user");
    expect(avatar?.reason).toContain("user");
  });

  it("reports an explicitly skipped component distinctly from unresolved", async () => {
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = await buildLintReport({
      config: resolvedConfig(root, { components: { Avatar: { skip: true } } }),
      mode: { kind: "incremental" },
    });

    const avatar = report.standards[0]?.components[0];
    expect(avatar?.planStatus).toBe("skipped");
    expect(avatar?.status).toBe("skipped");
    expect(avatar?.reason).toContain("Explicitly skipped");
  });

  it("preserves truncation metadata from RFC-006 state planning", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { a: "1" | "2" | "3"; b: "1" | "2" | "3" };
        export const Button = ({ a, b }: ButtonProps) => <button>{a}{b}</button>;
      `,
    );

    const report = await buildLintReport({
      config: resolvedConfig(root),
      mode: { kind: "incremental" },
      maxStates: 3,
    });

    const button = report.standards[0]?.components[0];
    expect(button?.totalPossibleStates).toBe(9);
    expect(button?.states).toHaveLength(3);
    expect(button?.truncated).toBe(true);
  });

  it("keeps multiple configured standards as separate report contexts", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = await buildLintReport({
      config: resolvedConfig(root, { standards: ["wcag22-aa", "rgaa4.1"] }),
      mode: { kind: "incremental" },
    });

    expect(report.standards.map((standard) => standard.standard)).toEqual(["wcag22-aa", "rgaa4.1"]);
    expect(report.standards[0]?.components).toHaveLength(1);
    expect(report.standards[1]?.components).toHaveLength(1);
    expect(report.standards[0]).not.toBe(report.standards[1]);
  });

  it("summarizes planning once across standards, never double-counting or favoring one standard", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(
      join(root, "Avatar.tsx"),
      `
        type AvatarProps = { user: { name: string } };
        export const Avatar = ({ user }: AvatarProps) => <img alt={user.name} />;
      `,
    );

    const report = await buildLintReport({
      config: resolvedConfig(root, { standards: ["wcag22-aa", "rgaa4.1", "wcag21-aa"] }),
      mode: { kind: "incremental" },
    });

    // Every standard reports the same two components (planning is
    // standard-independent today), so a naive per-standard sum would count
    // 3x — the summary must not.
    expect(report.summary.componentsReview).toBe(1);
    expect(report.summary.componentsSkipped).toBe(1);
    // The same underlying planning pass is reused verbatim per standard,
    // making the "not per-standard" property structurally explicit rather
    // than an implementation detail a reader has to trust.
    expect(report.standards[0]?.components).toBe(report.standards[1]?.components);
    expect(report.standards[1]?.components).toBe(report.standards[2]?.components);
  });

  it("produces deterministic state ordering across repeated runs", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { variant: "a" | "b" | "c" };
        export const Button = ({ variant }: ButtonProps) => <button>{variant}</button>;
      `,
    );

    const first = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });
    const second = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    expect(first.standards[0]?.components[0]?.states.map((state) => state.stateId)).toEqual(
      second.standards[0]?.components[0]?.states.map((state) => state.stateId),
    );
  });

  it("records the targeting mode and rescan flag", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "all" } });

    expect(report.targeting).toEqual({ mode: { kind: "all" }, rescanned: true, selection: { kind: "all" } });
  });

  it("reports no engines available, distinctly, when none are enabled", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = await buildLintReport({
      config: resolvedConfig(root, { engines: { static: false, rendered: false } }),
      mode: { kind: "incremental" },
    });

    expect(report.provider).toEqual({ kind: "unavailable", reason: "no engines are enabled in configuration" });
  });

  it("reports enabled engines truthfully without claiming full rule coverage", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });

    expect(report.provider).toEqual({ kind: "available", provider: "lantern-static@1.0.0, lantern-rendered-dom@1.0.0" });
  });

  it("evaluates a genuine static check end-to-end from existing scan/projection evidence", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/accessible-name": "error" } }),
      mode: { kind: "incremental" },
    });

    const button = report.standards[0]?.components[0];
    expect(button?.status).toBe("fail");
    for (const state of button?.states ?? []) {
      expect(state.checks).toEqual([
        expect.objectContaining({
          ruleId: "lantern/accessible-name",
          status: "fail",
          severity: "error",
          engine: { name: "lantern-static", version: "1.0.0" },
        }),
      ]);
    }
  });

  it("treats a configured rule with no supporting engine as review, never a silent pass", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/color-contrast": "warn" } }),
      mode: { kind: "incremental" },
    });

    const button = report.standards[0]?.components[0];
    const check = button?.states[0]?.checks[0];
    expect(check?.status).toBe("review");
    expect(check?.outcomeReason).toBe("unsupported");
    expect(check?.evidence[0]).toMatchObject({ kind: "capability", required: "rendered-dom" });
    expect(check?.reason).toBeDefined();
    expect(button?.status).toBe("review");
  });

  it("executes a genuine rendered check through the reused session runtime across multiple states", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );
    const { page, evaluate } = fakeRenderPage([
      {
        usableInteractiveCount: 1,
        enabledInteractiveCount: 1,
        tabbableCount: 1,
        disabledInteractiveCount: 0,
      },
      {
        usableInteractiveCount: 1,
        enabledInteractiveCount: 0,
        tabbableCount: 0,
        disabledInteractiveCount: 1,
      },
    ]);
    const newPage = vi.fn(() => Promise.resolve(page));
    const browser = {
      newPage,
      close: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as Browser;
    const launch = vi.fn(() => Promise.resolve(browser));
    const bundle = vi.fn(() => Promise.resolve("/* bundled */"));

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/keyboard-access": "error" } }),
      mode: { kind: "incremental" },
      bundle,
      launch,
    });

    const button = report.standards[0]?.components[0];
    expect(button?.states).toHaveLength(2);
    expect(button?.states.map((state) => state.checks[0]?.status)).toEqual(["pass", "pass"]);
    expect(button?.states.map((state) => state.checks[0]?.engine)).toEqual([
      { name: "lantern-rendered-dom", version: "1.0.0" },
      { name: "lantern-rendered-dom", version: "1.0.0" },
    ]);
    expect(button?.status).toBe("pass");
    expect(launch).toHaveBeenCalledTimes(1);
    expect(bundle).toHaveBeenCalledTimes(1);
    expect(newPage).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledTimes(6);
  });

  it("detects a genuine keyboard-access defect instead of fabricating a pass", async () => {
    writeFileSync(
      join(root, "Button.tsx"),
      `
        type ButtonProps = { disabled?: boolean };
        export const Button = ({ disabled }: ButtonProps) => <button disabled={disabled} />;
      `,
    );
    const { page } = fakeRenderPage([
      {
        usableInteractiveCount: 1,
        enabledInteractiveCount: 1,
        tabbableCount: 1,
        disabledInteractiveCount: 0,
      },
      // Bug: the rendered disabled state is actually enabled and excluded from tab order.
      {
        usableInteractiveCount: 1,
        enabledInteractiveCount: 1,
        tabbableCount: 0,
        disabledInteractiveCount: 0,
      },
    ]);
    const newPage = vi.fn(() => Promise.resolve(page));
    const browser = {
      newPage,
      close: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as Browser;
    const launch = vi.fn(() => Promise.resolve(browser));
    const bundle = vi.fn(() => Promise.resolve("/* bundled */"));

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/keyboard-access": "error" } }),
      mode: { kind: "incremental" },
      bundle,
      launch,
    });

    const button = report.standards[0]?.components[0];
    expect(button?.status).toBe("fail");
    expect(button?.states.map((state) => state.checks[0]?.status)).toEqual(["pass", "fail"]);
    expect(button?.states[1]?.checks[0]?.message).toContain(
      "none are in the sequential keyboard focus order",
    );
    const failedCheck = button?.states[1]?.checks[0];
    expect(typeof failedCheck?.checkId).toBe("string");
    expect(failedCheck?.componentId).toBe(button?.componentId);
    expect(failedCheck?.stateId).toBe(button?.states[1]?.stateId);
    expect(typeof failedCheck?.durationMs).toBe("number");
    expect(button?.states[1]?.checks[0]?.evidence).toContainEqual(expect.objectContaining({ kind: "expectation", observed: "excluded" }));
  });

  it("supports canonical component-ID selection and rejects unknown IDs as a typed selection error", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    writeFileSync(join(root, "Label.tsx"), "export const Label = () => <label />;");
    const all = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" } });
    const buttonId = all.standards[0]?.components.find((component) => component.component === "Button")?.componentId;
    const selected = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" }, componentIds: [buttonId!] });
    expect(selected.standards[0]?.components.map((component) => component.component)).toEqual(["Button"]);

    // Input/target validation errors are not operational engine failures
    // (RFC-009.1): they keep their own typed classification and reject the
    // promise, exactly like `LintTargetingError` did before RFC-009, instead
    // of being downgraded to a generic `status: "failed"` report.
    const invalidSelection = await buildLintReport({
      config: resolvedConfig(root), mode: { kind: "incremental" }, componentIds: ["missing#Thing"],
    }).catch((error: unknown) => error);
    expect(invalidSelection).toMatchObject({ name: "LintSelectionError", code: "LINT_SELECTION_INVALID" });
    expect(invalidSelection).toBeInstanceOf(Error);
    expect((invalidSelection as Error).message).toContain("Unknown canonical component ID");
  });

  it("propagates a typed LintTargetingError instead of converting it to an operational failure report", async () => {
    const badPath = await buildLintReport({
      config: resolvedConfig(root), mode: { kind: "path", path: "src/nope" },
    }).catch((error: unknown) => error);
    expect(badPath).toMatchObject({ name: "LintTargetingError", code: "LINT_TARGETING_INVALID" });
    expect((badPath as Error).message).toContain("Target path does not exist");
  });

  it("rejects unsupported state/check selectors as a typed selection error, not an operational failure", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");

    await expect(
      buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" }, stateIds: ["state-1"] }),
    ).rejects.toMatchObject({ name: "LintSelectionError", code: "LINT_SELECTION_INVALID" });
  });

  it("preserves already-collected component results when a later component's runtime never launches", async () => {
    // Sorted before "ZInteractive.tsx" so it is processed first; it never
    // needs the rendered-dom runtime, so it fully completes before the
    // browser launch failure aborts the run.
    writeFileSync(join(root, "AStatic.tsx"), "export const AStatic = () => <label>Text</label>;");
    writeFileSync(join(root, "ZInteractive.tsx"), "export const ZInteractive = () => <button />;");
    const launch = vi.fn(() => Promise.reject(new Error("no browser binary available")));

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/accessible-name": "error", "lantern/keyboard-access": "error" } }),
      mode: { kind: "incremental" },
      launch,
    });

    expect(report.status).toBe("failed");
    expect(report.diagnostics?.[0]).toMatchObject({ code: "OPERATIONAL_ERROR", severity: "error" });
    const components = report.standards[0]?.components.map((component) => component.component);
    expect(components).toContain("AStatic");
    expect(components).not.toContain("ZInteractive");
    // The partially-collected run still reports truthful, non-zero counts
    // instead of a synthetic empty summary.
    expect(report.summary.componentsPass + report.summary.componentsFail + report.summary.componentsReview).toBeGreaterThan(0);
  });

  it("emits correlated deterministic lifecycle events and supports cancellation", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const types: string[] = [];
    const report = await buildLintReport({ config: resolvedConfig(root, { rules: { "lantern/accessible-name": "error" } }), mode: { kind: "incremental" }, events: (event) => { types.push(event.type); } });
    expect(types).toEqual(["run-started", "component-started", "state-started", "check-started", "check-completed", "state-completed", "component-completed", "run-completed"]);
    expect(report.status).toBe("completed");

    const controller = new AbortController();
    controller.abort();
    const cancelledTypes: string[] = [];
    const cancelled = await buildLintReport({ config: resolvedConfig(root), mode: { kind: "incremental" }, signal: controller.signal, events: (event) => { cancelledTypes.push(event.type); } });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelledTypes).toEqual(["run-started", "diagnostic", "run-cancelled"]);
  });

  it("isolates one state's engine crash as an operational-error check outcome and keeps the run completed", async () => {
    writeFileSync(join(root, "Button.tsx"), "type Props = { variant: \"a\" | \"b\" }; export const Button = ({ variant }: Props) => <button data-variant={variant} />;");
    const evaluate = vi.fn();
    // First state's render probe throws (simulates a genuine engine crash);
    // the second state's render probe resolves normally.
    evaluate
      .mockImplementationOnce(() => Promise.resolve(undefined))
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementationOnce(() => Promise.reject(new Error("render probe crashed")))
      .mockImplementationOnce(() => Promise.resolve(undefined))
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementationOnce(() =>
        Promise.resolve({ usableInteractiveCount: 1, enabledInteractiveCount: 1, tabbableCount: 1, disabledInteractiveCount: 0 }),
      );
    const page = {
      setContent: vi.fn(() => Promise.resolve(undefined)),
      evaluate,
      addScriptTag: vi.fn(() => Promise.resolve(null)),
      waitForFunction: vi.fn(() => Promise.resolve(null)),
      close: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as Page;
    const browser = { newPage: vi.fn(() => Promise.resolve(page)), close: vi.fn(() => Promise.resolve(undefined)) } as unknown as Browser;
    const launch = vi.fn(() => Promise.resolve(browser));
    const bundle = vi.fn(() => Promise.resolve("/* bundled */"));

    const report = await buildLintReport({
      config: resolvedConfig(root, {
        rules: { "lantern/keyboard-access": "error" },
        components: { Button: { props: { variant: { values: ["a", "b"] } } } },
      }),
      mode: { kind: "incremental" },
      bundle,
      launch,
    });

    // A single check's engine exception is recoverable: the run still
    // completes rather than failing outright.
    expect(report.status).toBe("completed");
    const button = report.standards[0]?.components[0];
    expect(button?.states).toHaveLength(2);
    const [failedState, passedState] = button?.states ?? [];
    expect(failedState?.checks[0]).toMatchObject({
      checkId: failedState?.checks[0]?.checkId,
      componentId: button?.componentId,
      stateId: failedState?.stateId,
      ruleId: "lantern/keyboard-access",
      status: "review",
      outcomeReason: "operational-error",
    });
    expect(failedState?.checks[0]?.reason).toContain("render probe crashed");
    // The independent second check continued and completed normally.
    expect(passedState?.checks[0]?.status).toBe("pass");
    expect(passedState?.checks[0]?.outcomeReason).toBeUndefined();

    const checkDiagnostic = report.diagnostics?.find((diagnostic) => diagnostic.code === "CHECK_OPERATIONAL_ERROR");
    expect(checkDiagnostic).toMatchObject({
      scope: "check",
      componentId: button?.componentId,
      stateId: failedState?.stateId,
      checkId: failedState?.checks[0]?.checkId,
    });
  });

  it("preserves provenance for fixed configured props", async () => {
    writeFileSync(join(root, "Button.tsx"), "type Props = { label: string }; export const Button = ({ label }: Props) => <button>{label}</button>;");
    const report = await buildLintReport({ config: resolvedConfig(root, { components: { Button: { props: { label: { values: ["Save"] } } } } }), mode: { kind: "incremental" } });
    expect(report.standards[0]?.components[0]?.states[0]?.propProvenance).toEqual({ label: "explicit" });
  });

  it("does not launch a runtime for a rendered-dom rule no engine actually supports", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const launch = vi.fn(() => Promise.reject(new Error("must not launch")));

    const report = await buildLintReport({
      config: resolvedConfig(root, { rules: { "lantern/color-contrast": "warn" } }),
      mode: { kind: "incremental" },
      launch,
    });

    expect(launch).not.toHaveBeenCalled();
    expect(report.standards[0]?.components[0]?.states[0]?.checks[0]?.status).toBe("review");
  });

  it("captures a genuine engine/runtime failure as a structured failed run", async () => {
    writeFileSync(join(root, "Button.tsx"), "export const Button = () => <button />;");
    const launch = vi.fn(() => Promise.reject(new Error("no browser binary available")));

    const report = await buildLintReport({
        config: resolvedConfig(root, { rules: { "lantern/keyboard-access": "error" } }),
        mode: { kind: "incremental" },
        launch,
      });

    expect(report.status).toBe("failed");
    expect(report.diagnostics?.[0]).toMatchObject({ code: "OPERATIONAL_ERROR", severity: "error" });
    expect(report.diagnostics?.[0]?.message).toContain("no browser binary available");
  });
});
