import { ComponentRenderError } from "../errors/component-render-error.js";
import type { CheckResult } from "../lint/types.js";
import type { Engine, EngineExecutionContext, PlannedCheck, SupportResult } from "./types.js";

/**
 * Lantern's rendered-DOM engine (RFC-008): the minimal Lantern-owned
 * boundary proving real accessibility engines can execute through the
 * RFC-007.5 session/runtime — mount once per component, render each selected
 * state's props through the same reused browser/bundle.
 *
 * Evaluates `lantern/keyboard-access`: whether a component the accessibility
 * projection identifies as focusable actually receives keyboard focus when
 * rendered (and correctly withholds it while disabled) — evidence no static
 * scan can provide, since it depends on the real rendered DOM.
 */
export const LANTERN_RENDERED_ENGINE_ID = "lantern-rendered-dom";
export const LANTERN_RENDERED_ENGINE_VERSION = "1.0.0";

const SUPPORTED_RULE_ID = "lantern/keyboard-access";
const FOCUSABLE_SELECTOR = "button, a[href], input, select, textarea, [tabindex]";

interface FocusProbeResult {
  readonly found: boolean;
  readonly focused: boolean;
}

export function createRenderedDomEngine(): Engine {
  return {
    identity: { id: LANTERN_RENDERED_ENGINE_ID, version: LANTERN_RENDERED_ENGINE_VERSION },
    capabilities: ["rendered-dom"],
    supports(check: PlannedCheck): SupportResult {
      if (check.requiredCapability !== "rendered-dom" || check.ruleId !== SUPPORTED_RULE_ID) {
        return { kind: "unsupported", reason: `${LANTERN_RENDERED_ENGINE_ID} does not evaluate "${check.ruleId}".` };
      }
      if (!check.accessibility.interactivity.focusable) {
        return { kind: "unsupported", reason: "component is not identified as interactive/focusable" };
      }
      return { kind: "supported" };
    },
    async execute(check: PlannedCheck, context: EngineExecutionContext): Promise<CheckResult> {
      if (context.runtime === undefined) {
        throw new ComponentRenderError(
          `No component runtime session is available to render "${check.component}" for "${check.ruleId}".`,
        );
      }

      const engine = { name: LANTERN_RENDERED_ENGINE_ID, version: LANTERN_RENDERED_ENGINE_VERSION };
      const location = { file: check.source };
      const expectDisabled = check.stateProps?.["disabled"] === true;

      // Evaluated as a string, not a typed function: the project's tsconfig
      // has no DOM lib (this is a Node CLI), so this body only ever type-
      // checks inside the isolation page itself, exactly like the existing
      // mount-error probe in `runtime-session.ts`.
      const probe = await context.runtime.render(check.stateProps ?? {}, async ({ page }) =>
        page.evaluate<FocusProbeResult>(
          `(() => {
            var root = document.getElementById("root");
            var target = root ? root.querySelector(${JSON.stringify(FOCUSABLE_SELECTOR)}) : null;
            if (!target) { return { found: false, focused: false }; }
            target.focus();
            return { found: true, focused: document.activeElement === target };
          })()`,
        ),
      );

      if (!probe.found) {
        return {
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" is identified as interactive but rendered no focusable element (expected one of: ${FOCUSABLE_SELECTOR}).`,
          location,
          engine,
        };
      }
      if (!expectDisabled && !probe.focused) {
        return {
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" rendered a focusable element that did not receive keyboard focus.`,
          location,
          engine,
        };
      }
      if (expectDisabled && probe.focused) {
        return {
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" rendered with "disabled" but its element still received keyboard focus.`,
          location,
          engine,
        };
      }

      return {
        ruleId: check.ruleId,
        severity: check.severity,
        status: "pass",
        message: expectDisabled
          ? `"${check.component}" correctly withheld keyboard focus while disabled.`
          : `"${check.component}" rendered a focusable element that received keyboard focus.`,
        location,
        engine,
      };
    },
  };
}
