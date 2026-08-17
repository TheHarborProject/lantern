import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
    checkId: "check-1",
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

function runtimeForMarkup(browser: Browser, markup: string): ComponentRuntime {
  return {
    render: async <T>(
      _props: Record<string, unknown>,
      use: (render: IsolatedRender) => Promise<T>,
    ): Promise<T> => {
      const page = await browser.newPage();
      try {
        await page.setContent(`<div id="root">${markup}</div>`);
        return await use({ page });
      } finally {
        await page.close();
      }
    },
  };
}

describe("createRenderedDomEngine", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("identifies itself", () => {
    const engine = createRenderedDomEngine();
    expect(engine.identity).toEqual({ id: "lantern-rendered-dom", version: "1.0.0" });
    expect(engine.capabilities).toEqual(["rendered-dom"]);
  });

  it("only supports lantern/keyboard-access for a focusable component over rendered-dom evidence", () => {
    const engine = createRenderedDomEngine();

    expect(engine.supports(check()).kind).toBe("supported");
    expect(engine.supports(check({ ruleId: "lantern/color-contrast" })).kind).toBe("unsupported");
    expect(engine.supports(check({ requiredCapability: "static-evidence" })).kind).toBe(
      "unsupported",
    );
    expect(
      engine.supports(
        check({
          accessibility: accessibility({ interactivity: { focusable: false, handlers: [] } }),
        }),
      ).kind,
    ).toBe("unsupported");
  });

  it("throws an operational error instead of fabricating a result when no runtime is available", async () => {
    const engine = createRenderedDomEngine();

    await expect(engine.execute(check(), {})).rejects.toThrow(ComponentRenderError);
  });

  it("passes a normal native button", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check(), {
      runtime: runtimeForMarkup(browser, "<button>Save</button>"),
    });

    expect(result.status).toBe("pass");
    expect(result.message).toContain("sequential keyboard focus order");
    expect(result.evidence).toContainEqual({ kind: "observation", name: "tabIndex", value: 0 });
    expect(result.engine).toEqual({ name: "lantern-rendered-dom", version: "1.0.0" });
  });

  it('fails a native button with tabindex="-1"', async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check(), {
      runtime: runtimeForMarkup(browser, '<button tabindex="-1">Save</button>'),
    });

    expect(result.status).toBe("fail");
    expect(result.evidence).toContainEqual({ kind: "observation", name: "tabIndex", value: -1 });
    expect(result.message).toContain("none are in the sequential keyboard focus order");
  });

  it("passes a disabled native button based on its rendered DOM state", async () => {
    const engine = createRenderedDomEngine();

    const result = await engine.execute(check({ stateProps: { disabled: false } }), {
      runtime: runtimeForMarkup(browser, "<button disabled>Save</button>"),
    });

    expect(result.status).toBe("pass");
    expect(result.evidence).toContainEqual({ kind: "observation", name: "disabled", value: true });
    expect(result.message).toContain("only disabled interactive elements");
  });

  it.each(['<div tabindex="0">Control</div>', '<div tabindex="2">Control</div>'])(
    "passes an enabled element with a non-negative tabindex: %s",
    async (markup) => {
      const engine = createRenderedDomEngine();
      const result = await engine.execute(check(), { runtime: runtimeForMarkup(browser, markup) });

      expect(result.status).toBe("pass");
    },
  );

  it.each([
    "<span>Not interactive</span>",
    "<button hidden>Hidden</button>",
    "<div inert><button>Inert</button></div>",
  ])("fails when there is no visible, usable interactive element: %s", async (markup) => {
    const engine = createRenderedDomEngine();
    const result = await engine.execute(check(), { runtime: runtimeForMarkup(browser, markup) });

    expect(result.status).toBe("fail");
    expect(result.message).toContain("no visible, usable interactive element");
  });
});
