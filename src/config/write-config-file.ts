import { renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Write a configuration object atomically: temporary file in the same
 * directory, then rename (RFC-006), so an interruption never leaves a
 * partially written configuration file behind.
 */
export function writeConfigFile(filePath: string, data: unknown): void {
  const content = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = join(dirname(filePath), `.snaprun-config-${process.pid}-${Date.now()}.tmp`);

  writeFileSync(tempPath, content, "utf-8");
  renameSync(tempPath, filePath);
}
