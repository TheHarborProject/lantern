import { readFileSync } from "node:fs";
import { ConfigInvalidError } from "../errors/config-invalid-error.js";

/** Read and parse raw JSON from a configuration file. */
export function readConfigFile(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf-8");

  try {
    return JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ConfigInvalidError(
      `Configuration file is not valid JSON: ${filePath}`,
      { cause },
    );
  }
}
