import { projectAccessibility } from "../component-scan/project-accessibility.js";
import { DEFAULT_MAX_STATES, planComponentState } from "../state-planning/plan-component-state.js";
import type { CanonicalComponentModel } from "../types/component-scan.js";
import type { ResolvedConfig } from "../types/config.js";
import type { SelectableComponent } from "./types.js";

export function buildSelectableComponents(model: CanonicalComponentModel, config: ResolvedConfig, maxStates = DEFAULT_MAX_STATES): readonly SelectableComponent[] {
  const accessibility = new Map(projectAccessibility(model).components.map((component) => [component.id, component]));
  const configs = resolveConfigs(model, config);
  return [...model.components]
    .sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id))
    .map((component) => {
      const projected = accessibility.get(component.id);
      if (projected === undefined) return { id: component.id, name: component.name, source: component.source, states: [] };
      const plan = planComponentState({ component, accessibility: projected, componentConfig: configs.get(component.id), fixtures: config.fixtures, maxStates });
      return {
        id: component.id, name: component.name, source: component.source,
        states: plan.status === "ready" ? plan.states.map((state) => ({ id: state.id, label: stateLabel(state.props) })) : [],
      };
    });
}

function resolveConfigs(model: CanonicalComponentModel, config: ResolvedConfig): ReadonlyMap<string, NonNullable<ResolvedConfig["components"][string]>> {
  const result = new Map<string, NonNullable<ResolvedConfig["components"][string]>>();
  for (const [key, value] of Object.entries(config.components)) {
    const exact = model.components.find(({ id }) => id === key);
    if (exact !== undefined) { result.set(exact.id, value); continue; }
    const matches = model.components.filter(({ name }) => name === key);
    if (matches.length === 1 && matches[0] !== undefined) result.set(matches[0].id, value);
  }
  return result;
}

function stateLabel(props: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(props);
  if (entries.length === 0) return "default";
  return entries.map(([key, value]) => `${key}=${display(value)}`).join(" / ");
}

function display(value: unknown): string {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? String(value) : encoded;
}
