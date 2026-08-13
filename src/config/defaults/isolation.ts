import type { IsolationConfig } from "../../schemas/isolation.js";

/**
 * Starter `isolation` section for Lantern. These are discoverable example
 * values, not runtime defaults: they document the project-level globals so a
 * shared context is declared once instead of per component. Adapt or delete the
 * fields that do not apply — the whole section is optional.
 */
export const defaultIsolationConfig: IsolationConfig = {
  globalCss: ["src/app/globals.css"],
  wrapper: "lantern/isolation-wrapper.tsx",
  wrapperExport: "default",
};
