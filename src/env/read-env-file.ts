import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";

/**
 * Read and parse a `.env` file. Returns `{}` when the file does not exist.
 *
 * Parsing delegates to `dotenv.parse()` (RFC-003, review follow-up): only
 * the parsing API is used, never `dotenv.config()`, so SnapRun keeps full
 * control over precedence and never writes into `process.env`
 * (`process.env` > `.env.local` > `.env`).
 */
export function readEnvFile(workingDirectory: string, fileName: string): Record<string, string> {
  const filePath = join(workingDirectory, fileName);

  if (!existsSync(filePath)) {
    return {};
  }

  return parse(readFileSync(filePath, "utf-8"));
}
