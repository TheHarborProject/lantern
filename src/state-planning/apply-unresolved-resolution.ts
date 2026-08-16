import { mergeComponents } from "../config/resolve/merge-fragments.js";
import type { ComponentPropConfig } from "../schemas/components.js";
import type { RawConfig } from "../types/config.js";

/**
 * A user's choice for resolving one unresolved required prop (RFC-006).
 *
 * This is the reusable core of the interactive configuration workflow: RFC-006
 * only exposes these pure, testable transforms plus the thin file-IO wrapper in
 * `configure-unresolved-props.ts`. A later RFC-007 CLI command owns turning a
 * human's answer into one of these choices and prompting for it — no CLI
 * surface, output formatting, or Inquirer usage lives here.
 */
export type PropResolutionChoice =
  | { readonly type: "values"; readonly values: readonly unknown[] }
  | { readonly type: "fixture"; readonly fixture: string; readonly createWithValues?: readonly unknown[] | undefined }
  | { readonly type: "placeholder" };

/**
 * Apply one prop resolution choice to raw configuration, returning a new,
 * still-valid `RawConfig` — never mutating the input. Reuses the exact
 * component/prop merge semantics from the RFC-005 resolution layer so a single
 * written prop cannot clobber sibling props or components.
 *
 * - `"values"`: writes explicit inline values for the prop.
 * - `"fixture"`: references a named fixture; when `createWithValues` is given,
 *   the fixture is also (re)declared in the central `fixtures` section.
 * - `"placeholder"`: writes an empty prop entry (`{}`), acknowledging the prop
 *   without resolving it — a durable, actionable marker for later configuration.
 */
export function applyPropResolution(
  config: RawConfig,
  componentName: string,
  propName: string,
  choice: PropResolutionChoice,
): RawConfig {
  let propConfig: ComponentPropConfig;
  let fixtures = config.fixtures;

  if (choice.type === "values") {
    propConfig = { values: [...choice.values] };
  } else if (choice.type === "fixture") {
    propConfig = { fixture: choice.fixture };
    if (choice.createWithValues !== undefined) {
      fixtures = { ...(fixtures ?? {}), [choice.fixture]: [...choice.createWithValues] };
    }
  } else {
    propConfig = {};
  }

  const components = mergeComponents(config.components ?? {}, {
    [componentName]: { props: { [propName]: propConfig } },
  });

  return { ...config, components, ...(fixtures !== undefined ? { fixtures } : {}) };
}

/**
 * Explicitly opt a component out of state generation (`components.<name>.skip`).
 * Distinct from leaving a prop unresolved: a skip is a deliberate, durable user
 * decision, recorded once in `lantern.config.json` rather than re-surfaced on
 * every run.
 */
export function applySkipComponent(config: RawConfig, componentName: string): RawConfig {
  const components = mergeComponents(config.components ?? {}, { [componentName]: { skip: true } });

  return { ...config, components };
}
