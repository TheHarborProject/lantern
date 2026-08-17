import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCAN_SCHEMA_VERSION = 2;
const DEPENDENCY_FILES = ["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"];

export function computeScanFingerprint(input: {
  readonly root: string;
  readonly sourceHashes: Readonly<Record<string, string>>;
  readonly ignorePatterns: readonly string[];
}): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ version: SCAN_SCHEMA_VERSION, sourceHashes: input.sourceHashes }));
  hash.update(JSON.stringify({ ignorePatterns: [...input.ignorePatterns].sort() }));
  hash.update(readIfExists(input.root, "tsconfig.json"));
  for (const fileName of DEPENDENCY_FILES) {
    hash.update(fileName);
    hash.update(readIfExists(input.root, fileName));
  }
  return hash.digest("hex");
}

function readIfExists(root: string, fileName: string): string {
  const path = join(root, fileName);
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}
