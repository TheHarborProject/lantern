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
 * projection identifies as focusable renders an element in the sequential
 * keyboard focus order (and correctly removes a disabled element from that
 * order) — evidence no static scan can provide, since it depends on the real
 * rendered DOM.
 */
export const LANTERN_RENDERED_ENGINE_ID = "lantern-rendered-dom";
export const LANTERN_RENDERED_ENGINE_VERSION = "1.0.0";

const SUPPORTED_RULE_ID = "lantern/keyboard-access";
const INTERACTIVE_SELECTOR =
  "button, a[href], area[href], input, select, textarea, summary, iframe, object, embed, audio[controls], video[controls], [contenteditable], [tabindex]";

interface KeyboardAccessProbeResult {
  readonly usableInteractiveCount: number;
  readonly enabledInteractiveCount: number;
  readonly tabbableCount: number;
  readonly disabledInteractiveCount: number;
}

export function createRenderedDomEngine(): Engine {
  return {
    identity: { id: LANTERN_RENDERED_ENGINE_ID, version: LANTERN_RENDERED_ENGINE_VERSION },
    capabilities: ["rendered-dom"],
    supports(check: PlannedCheck): SupportResult {
      if (check.requiredCapability !== "rendered-dom" || check.ruleId !== SUPPORTED_RULE_ID) {
        return {
          kind: "unsupported",
          reason: `${LANTERN_RENDERED_ENGINE_ID} does not evaluate "${check.ruleId}".`,
        };
      }
      if (!check.accessibility.interactivity.focusable) {
        return {
          kind: "unsupported",
          reason: "component is not identified as interactive/focusable",
        };
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
      // Evaluated as a string, not a typed function: the project's tsconfig
      // has no DOM lib (this is a Node CLI), so this body only ever type-
      // checks inside the isolation page itself, exactly like the existing
      // mount-error probe in `runtime-session.ts`.
      const probe = await context.runtime.render(check.stateProps ?? {}, async ({ page }) =>
        page.evaluate<KeyboardAccessProbeResult>(
          `(() => {
            var root = document.getElementById("root");
            var candidates = root ? Array.from(root.querySelectorAll(${JSON.stringify(INTERACTIVE_SELECTOR)})) : [];
            var usable = candidates.filter(function (element) {
              if (element.closest("[hidden], [inert]")) { return false; }
              if (element.getClientRects().length === 0) { return false; }
              for (var current = element; current; current = current.parentElement) {
                var style = getComputedStyle(current);
                if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
                  return false;
                }
              }
              return true;
            });
            var disabled = usable.filter(function (element) { return element.matches(":disabled"); });
            var enabled = usable.filter(function (element) { return !element.matches(":disabled"); });
            var tabbable = enabled.filter(function (element) {
              var tag = element.tagName.toLowerCase();
              var nativeFocusable =
                tag === "button" || tag === "select" || tag === "textarea" || tag === "summary" ||
                tag === "iframe" || tag === "object" || tag === "embed" ||
                ((tag === "a" || tag === "area") && element.hasAttribute("href")) ||
                (tag === "input" && element.getAttribute("type") !== "hidden") ||
                ((tag === "audio" || tag === "video") && element.hasAttribute("controls"));
              var explicitlyFocusable = element.hasAttribute("tabindex") || element.hasAttribute("contenteditable");
              return (nativeFocusable || explicitlyFocusable) && element.tabIndex >= 0;
            });
            return {
              usableInteractiveCount: usable.length,
              enabledInteractiveCount: enabled.length,
              tabbableCount: tabbable.length,
              disabledInteractiveCount: disabled.length
            };
          })()`,
        ),
      );

      if (probe.usableInteractiveCount === 0) {
        return {
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" is identified as interactive but rendered no visible, usable interactive element.`,
          location,
          engine,
        };
      }
      if (probe.enabledInteractiveCount > 0 && probe.tabbableCount === 0) {
        return {
          ruleId: check.ruleId,
          severity: check.severity,
          status: "fail",
          message: `"${check.component}" rendered an enabled interactive element, but none are in the sequential keyboard focus order.`,
          location,
          engine,
        };
      }
      return {
        ruleId: check.ruleId,
        severity: check.severity,
        status: "pass",
        message:
          probe.tabbableCount > 0
            ? `"${check.component}" rendered an enabled interactive element in the sequential keyboard focus order.`
            : `"${check.component}" rendered only disabled interactive elements, correctly excluding them from the sequential keyboard focus order.`,
        location,
        engine,
      };
    },
  };
}
