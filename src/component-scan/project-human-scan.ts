import type {
  CanonicalComponent,
  CanonicalComponentModel,
  ComponentScanIndex,
  DiscoveredComponent,
} from "../types/component-scan.js";

/**
 * Derive the concise, human-readable projection from the canonical model.
 *
 * Only component-owned props are surfaced: the exhaustive inherited
 * DOM/React prop surface is intentionally omitted here and remains available in
 * the internal model.
 */
export function projectHumanScan(model: CanonicalComponentModel): ComponentScanIndex {
  return {
    version: 2,
    components: model.components.map(toDiscoveredComponent),
    diagnostics: model.diagnostics,
  };
}

function toDiscoveredComponent(component: CanonicalComponent): DiscoveredComponent {
  return {
    id: component.id,
    source: component.source,
    exportName: component.exportName,
    name: component.name,
    exportKind: component.exportKind,
    props: component.props
      .filter((prop) => prop.origin === "component")
      .map((prop) => ({ name: prop.name, type: prop.type, required: prop.required })),
    analysis: component.analysis,
  };
}
