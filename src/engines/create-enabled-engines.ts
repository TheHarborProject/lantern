import type { EngineConfig } from "../schemas/engines.js";
import { createRenderedDomEngine } from "./rendered-dom-engine.js";
import { createStaticEngine } from "./static-engine.js";
import type { Engine } from "./types.js";

/**
 * Instantiate the enabled Lantern-owned engines from resolved configuration
 * (RFC-008). `axe`/`lighthouse` stay reserved — no engine is created for them
 * yet, matching the schema's documented scope.
 */
export function createEnabledEngines(config: EngineConfig): readonly Engine[] {
  const engines: Engine[] = [];
  if (config.static) {
    engines.push(createStaticEngine());
  }
  if (config.rendered) {
    engines.push(createRenderedDomEngine());
  }
  return engines;
}
