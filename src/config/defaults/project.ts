import type { ProjectConfig } from "../../schemas/project.js";

/**
 * Starter `project` section for Lantern. These
 * are discoverable example values, not runtime defaults: they document every
 * supported `project` field so users can adapt or delete what they do not need.
 */
export const defaultProjectConfig: ProjectConfig = {
  root: ".",
  workingDirectory: ".",
  sourceDirectory: ".",
  baseUrl: "http://localhost:3000",
  startScript: "dev",
  autoStart: true,
};
