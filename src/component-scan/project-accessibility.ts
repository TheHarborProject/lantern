import type {
  AccessibilityComponent,
  AccessibilityIndex,
  CanonicalComponent,
  CanonicalComponentModel,
} from "../types/component-scan.js";

/**
 * Web-platform facts used to describe a component's accessibility surface.
 *
 * These are general HTML/ARIA facts, not the rule catalog of any concrete
 * accessibility engine. The projection reports what a component exposes; it does
 * not decide whether that is correct.
 */
const NATIVELY_FOCUSABLE_ELEMENTS = new Set([
  "a",
  "button",
  "details",
  "input",
  "select",
  "summary",
  "textarea",
]);

const ACCESSIBLE_NAME_PROPS = new Set([
  "alt",
  "aria-label",
  "aria-labelledby",
  "label",
  "name",
  "placeholder",
  "title",
]);

const STATE_PROPS = new Set([
  "busy",
  "checked",
  "current",
  "disabled",
  "expanded",
  "hidden",
  "invalid",
  "open",
  "pressed",
  "readonly",
  "required",
  "selected",
]);

const INTERACTION_HANDLER_PROPS = new Set([
  "onBlur",
  "onChange",
  "onClick",
  "onFocus",
  "onInput",
  "onKeyDown",
  "onKeyPress",
  "onKeyUp",
  "onSubmit",
  "onToggle",
]);

/** Derive the accessibility projection from the canonical model. */
export function projectAccessibility(model: CanonicalComponentModel): AccessibilityIndex {
  return {
    version: 2,
    components: model.components.map(toAccessibilityComponent),
  };
}

function toAccessibilityComponent(component: CanonicalComponent): AccessibilityComponent {
  const propNames = component.props.map((prop) => prop.name);
  const lowerToNames = new Map(propNames.map((name) => [name.toLowerCase(), name] as const));

  const nativeElements = component.rendering.intrinsicElements;
  const focusable =
    nativeElements.some((element) => NATIVELY_FOCUSABLE_ELEMENTS.has(element)) ||
    lowerToNames.has("tabindex");

  return {
    id: component.id,
    name: component.name,
    source: component.source,
    semantics: {
      nativeElements,
      derived: nativeElements.length > 0,
    },
    interactivity: {
      focusable,
      handlers: propNames.filter((name) => INTERACTION_HANDLER_PROPS.has(name)).sort(compareText),
    },
    accessibleNameSources: collectAccessibleNameSources(propNames),
    ariaProps: propNames.filter(isAriaProp).sort(compareText),
    stateProps: propNames.filter((name) => STATE_PROPS.has(name.toLowerCase())).sort(compareText),
    runtimeAnalysisRequired:
      !component.rendering.analyzable || component.analysis.status === "partial",
  };
}

function collectAccessibleNameSources(propNames: readonly string[]): string[] {
  const sources = propNames.filter((name) => ACCESSIBLE_NAME_PROPS.has(name.toLowerCase()));
  if (propNames.includes("children")) {
    sources.push("children");
  }
  return [...new Set(sources)].sort(compareText);
}

function isAriaProp(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "role" || lower.startsWith("aria-");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
