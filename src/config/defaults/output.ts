import type { OutputConfig } from "../../schemas/output.js";

/**
 * Starter `output` section written by `snaprun init` (RFC-013 §12). Exposes
 * every supported `output` field with its representative value.
 */
export const defaultOutputConfig: OutputConfig = {
  directory: "./snapshots",
  fullPage: true,
  structure: "flat",
};
