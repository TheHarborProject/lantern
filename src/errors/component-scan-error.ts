import { LanternError } from "./lantern-error.js";

export class ComponentScanError extends LanternError {
  readonly code = "COMPONENT_SCAN_FAILED";
}
