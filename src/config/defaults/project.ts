import type { ProjectConfig } from "../../schemas/project.js";

/**
 * Starter `project` section written by `snaprun init` (RFC-013 §12). These
 * are discoverable example values, not runtime defaults: they document every
 * supported `project` field so users can adapt or delete what they do not need.
 */
export const defaultProjectConfig: ProjectConfig = {
  root: ".",
  workingDirectory: ".",
  baseUrl: "http://localhost:3000",
  startCommand: "pnpm dev",
  autoStart: true,
};
