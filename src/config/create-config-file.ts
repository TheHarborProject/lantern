import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { ConfigAlreadyExistsError } from "../errors/config-already-exists-error.js";
import { ConfigInvalidError } from "../errors/config-invalid-error.js";

interface NodeError extends Error {
  readonly code?: string;
}

/**
 * Create a new configuration file without ever overwriting an existing one
 * (RFC-013 §13/§15). Uses an exclusive-create write (`flag: "wx"`) so the
 * existence check and the write are atomic: a concurrent process cannot slip a
 * file in between. The serialized JSON uses stable two-space formatting and a
 * trailing newline (RFC-013 §15).
 *
 * @throws {ConfigAlreadyExistsError} A file already exists at `filePath`.
 * @throws {ConfigInvalidError} The file could not be written for another reason.
 */
export function createConfigFile(filePath: string, data: unknown): void {
  const content = `${JSON.stringify(data, null, 2)}\n`;

  try {
    writeFileSync(filePath, content, { encoding: "utf-8", flag: "wx" });
  } catch (cause) {
    if ((cause as NodeError).code === "EEXIST") {
      throw new ConfigAlreadyExistsError(`${basename(filePath)} already exists`, { cause });
    }

    throw new ConfigInvalidError(`Could not create configuration file: ${filePath}`, { cause });
  }
}
