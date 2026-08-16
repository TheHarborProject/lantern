import { readConfigFile } from "../config/read-config-file.js";
import { validateConfig } from "../config/validate-config.js";
import { writeConfigFile } from "../config/write-config-file.js";
import type { RawConfig } from "../types/config.js";
import { applyPropResolution, applySkipComponent, type PropResolutionChoice } from "./apply-unresolved-resolution.js";

/**
 * Reusable read-modify-write workflow for resolving unresolved component props
 * (RFC-006), built entirely from the existing configuration IO primitives
 * (`readConfigFile`, `validateConfig`, `writeConfigFile`) so it needs no parallel
 * configuration system. This is the module RFC-007 wires into an interactive
 * `lantern lint --configure`-style CLI command; it deliberately has no CLI
 * surface, prompt, or output formatting of its own.
 *
 * Every write re-reads the file first, so two sequential calls against the same
 * path never clobber each other's unrelated changes.
 */

function loadRawConfig(configFilePath: string): RawConfig {
  return validateConfig(readConfigFile(configFilePath), configFilePath);
}

/** Resolve one component's prop and persist the result to `lantern.config.json`. */
export function configurePropResolution(
  configFilePath: string,
  componentName: string,
  propName: string,
  choice: PropResolutionChoice,
): RawConfig {
  const updated = applyPropResolution(loadRawConfig(configFilePath), componentName, propName, choice);
  writeConfigFile(configFilePath, updated);
  return updated;
}

/** Explicitly skip a component and persist the decision to `lantern.config.json`. */
export function configureSkipComponent(configFilePath: string, componentName: string): RawConfig {
  const updated = applySkipComponent(loadRawConfig(configFilePath), componentName);
  writeConfigFile(configFilePath, updated);
  return updated;
}
