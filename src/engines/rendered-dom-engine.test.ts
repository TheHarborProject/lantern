import { describe, expect, it, vi } from "vitest";
import { ComponentRenderError } from "../errors/component-render-error.js";
import type { ComponentRuntime, IsolatedRender } from "../component-runtime/types.js";
import type { AccessibilityComponent } from "../types/component-scan.js";
import { createRenderedDomEngine } from "./rendered-dom-engine.js";
import type { PlannedCheck } from "./types.js";

function accessibility(overrides: Partial<AccessibilityComponent> = {}): AccessibilityComponent {
  return {
    id: "Button.tsx#Button",
    name: "Button",
    source: "Button.tsx",
    semantics: { nativeElements: ["button"], derived: true },
    interactivity: { focusable: true, handlers: [] },
    accessibleNameSources: [],
    ariaProps: [],
    stateProps: [],
    runtimeAnalysisRequired: false,
    ...overrides,
  };
}

function check(overrides: Partial<PlannedCheck> = {}): PlannedCheck {
  return {
    ruleId: "lantern/keyboard-access",
    severity: "error",
    componentId: "Button.tsx#Button",
    component: "Button",
    source: "Button.tsx",
    requiredCapability: "rendered-dom",
    stateId: "Button.tsx#Button#a",
    stateProps: {},
    accessibility: accessibility(),
    ...overrides,
  };
}

function fakeRuntime(probe: { readonly found: boolean; readonly focused: boolean }): ComponentRuntime {
  return {
    render: async <T>(_props: Record<string, unknown>, use: (render: IsolatedRender) => Promise<T>): Promise<T> => {
      const page = { evaluate: vi.fn(() => Promise.resolve(probe)) } as unknown as IsolatedRender["page"];
      return use({ page });
    },
  };
}

describe("createRenderedDomEngine", () => {
  it("identifies itself", () => {
    const engine = createRenderedDomEngine();
    expect(engine.identity).toEqual({ id: "lantern-rendered-dom", version: "1.0.0" });
    expect(engine.capabilities).toEqual(["rendered-dom"]);
  });

  it("only supports lantern/keyboard-access for a focusable component over rendered-dom evidence", () => {
    const engine = createRenderedDomEngine();

    expect(engine.supports(check()).kind).toBe("supported");
    expect(engine.supports(check({ ruleId: "lantern/color-contrast" })).kind).toBe("unsupported");
    expect(engine.supports(check({ requiredCapability: "static-evidence" })).kind).toBe("unsupported");
    expect(
      engine.supports(check({ accessibility: accessibility({ interactivity: { focusable: false, handlers: [] } }) }))
        .kind,
    ).toBe("unsupported");
  });

  it("throws an operational error instead of fabricating a result when no runtime is available", async () => {
    const engine = createRenderedDomEngine();

    await expect(engine.execute(check(), {})).rejects.toThrow(ComponentRenderError);
  });

  it("fails when the component is expected to be focusable but renders no focusable element", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check(), { runtime: fakeRuntime({ found: false, focused: false }) });

    expect(result.status).toBe("fail");
    expect(result.message).toContain("no focusable element");
  });

  it("fails when an enabled element does not receive keyboard focus", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check({ stateProps: { disabled: false } }), {
      runtime: fakeRuntime({ found: true, focused: false }),
    });

    expect(result.status).toBe("fail");
    expect(result.message).toContain("did not receive keyboard focus");
  });

  it("fails when a disabled element still receives keyboard focus", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check({ stateProps: { disabled: true } }), {
      runtime: fakeRuntime({ found: true, focused: true }),
    });

    expect(result.status).toBe("fail");
    expect(result.message).toContain("still received keyboard focus");
  });

  it("passes when an enabled element receives focus", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check({ stateProps: { disabled: false } }), {
      runtime: fakeRuntime({ found: true, focused: true }),
    });

    expect(result.status).toBe("pass");
    expect(result.engine).toEqual({ name: "lantern-rendered-dom", version: "1.0.0" });
  });

  it("passes when a disabled element correctly withholds focus", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check({ stateProps: { disabled: true } }), {
      runtime: fakeRuntime({ found: true, focused: false }),
    });

    expect(result.status).toBe("pass");
  });
});
