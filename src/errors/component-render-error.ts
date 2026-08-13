import { LanternError } from "./lantern-error.js";

/**
 * Raised when the isolated component runtime cannot mount a component: a missing
 * source, a bundling failure, an unmet provider/style, or a render error. The
 * message states what is missing so it can be acted on.
 */
export class ComponentRenderError extends LanternError {
  readonly code = "COMPONENT_RENDER_FAILED";
}
