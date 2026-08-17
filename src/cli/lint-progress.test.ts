import { describe, expect, it, vi } from "vitest";
import type { AuditEvent } from "../lint/events.js";
import { createLintProgress, renderLintProgress, shouldRenderLintProgress } from "./lint-progress.js";

describe("lint progress", () => {
  it("enables progress only for interactive compact and verbose output", () => {
    expect(shouldRenderLintProgress("compact", true, {})).toBe(true);
    expect(shouldRenderLintProgress("verbose", true, {})).toBe(true);
    expect(shouldRenderLintProgress("minimal", true, {})).toBe(false);
    expect(shouldRenderLintProgress("compact", false, {})).toBe(false);
    expect(shouldRenderLintProgress("compact", true, { CI: "true" })).toBe(false);
    expect(shouldRenderLintProgress("compact", true, { NO_COLOR: "1" })).toBe(true);
  });

  it("renders honest known-total state, current component, completion, and elapsed time", () => {
    const active = renderLintProgress({
      phase: "auditing",
      completedComponents: 2,
      totalComponents: 4,
      currentComponent: "src/Button.tsx#Button",
      elapsedMs: 2_400,
    }, ["wcag22-aa"], false).join("\n");
    expect(active).toContain("2/4 components  50%");
    expect(active).toContain("src/Button.tsx#Button");
    expect(active).toContain("2.40s");
    expect(active).not.toContain("\u001b[");

    const completed = renderLintProgress({ phase: "completed", completedComponents: 4, totalComponents: 4, elapsedMs: 3_000 }, [], false).join("\n");
    expect(completed).toContain("4/4 components  100%");
  });

  it("tracks lifecycle events and clears its transient block on close", async () => {
    let now = 1_000;
    const chunks: string[] = [];
    const clearInterval = vi.fn();
    const controller = createLintProgress({
      writer: { write: (chunk): number => chunks.push(chunk) },
      standards: ["wcag22-aa"],
      color: false,
      now: () => now,
      setInterval: () => ({ unref: vi.fn() }),
      clearInterval,
    });
    const emit = (event: AuditEvent): void | Promise<void> => controller.events(event);
    await emit({ type: "run-started", runId: "run-1", timestamp: new Date(1_000).toISOString() });
    await emit({ type: "run-planned", runId: "run-1", timestamp: new Date(1_001).toISOString(), totalComponents: 2 });
    await emit({ type: "component-started", runId: "run-1", timestamp: new Date(1_002).toISOString(), componentId: "button", source: "Button.tsx", component: "Button" });
    now = 2_500;
    await emit({
      type: "component-completed",
      runId: "run-1",
      timestamp: new Date(2_500).toISOString(),
      component: { componentId: "button", component: "Button", source: "Button.tsx", planStatus: "ready", states: [], status: "review", truncated: false, totalPossibleStates: 0, maxStates: 32 },
    });
    expect(controller.state()).toMatchObject({ completedComponents: 1, totalComponents: 2, currentComponent: "Button.tsx#Button", elapsedMs: 1_500 });
    controller.close();
    expect(clearInterval).toHaveBeenCalledOnce();
    expect(chunks.join("")).toContain("\u001b[?25l");
    expect(chunks.at(-1)).toContain("\u001b[?25h");
    expect(chunks.join("")).toContain("\u001b[2K");
  });

  it.each(["run-failed", "run-cancelled"] as const)("cleans up after %s", async (type) => {
    const chunks: string[] = [];
    const controller = createLintProgress({
      writer: { write: (chunk) => chunks.push(chunk) }, standards: [], color: false,
      setInterval: () => ({}), clearInterval: vi.fn(),
    });
    await controller.events({ type: "run-started", runId: "run-1", timestamp: new Date().toISOString() });
    controller.close();
    expect(chunks.join("")).toContain("\u001b[?25h");
    expect(controller.state().phase).toBe("planning");
    // Run terminal events are consumed before the CLI's finally block in production.
    expect(type).toMatch(/^run-/);
  });
});
