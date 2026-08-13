import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT_DIR = process.cwd();
const PUBLIC_FILES = [
  "src/cli/program.ts",
  "src/cli/commands/default.ts",
  "src/cli/commands/scan.ts",
  "src/cli/print-cli-error.ts",
  "src/output/format-scan-summary.ts",
  "src/output/format-snapshot-report.ts",
  "src/errors/application-start-failed-error.ts",
  "src/errors/application-unreachable-error.ts",
  "src/errors/authentication-failed-error.ts",
  "src/errors/base-url-missing-error.ts",
  "src/errors/dynamic-parameter-missing-error.ts",
  "src/errors/dynamic-parameter-unknown-error.ts",
  "src/errors/env-variable-missing-error.ts",
  "src/errors/invalid-path-segment-error.ts",
  "src/errors/route-not-found-error.ts",
  "src/errors/run-not-found-error.ts",
  "src/errors/snapshot-failed-error.ts",
  "src/errors/user-conflict-error.ts",
  "src/errors/user-not-found-error.ts",
  "README.md",
  "examples/snapshot.config.json",
] as const;

const FORBIDDEN_PUBLIC_FRENCH = [
  /\bAffiche\b/u,
  /\bDétecte\b/u,
  /\bUtilisateur\b/u,
  /\bÉchec\b/u,
  /\bintrouvable\b/u,
  /\bconfiguration manuelle\b/u,
  /\bFichier inchangé\b/u,
  /\bFichier de configuration modifié\b/u,
] as const;

describe("public language", () => {
  it("keeps primary public-facing files in English", () => {
    for (const relativePath of PUBLIC_FILES) {
      const content = stripComments(readFileSync(join(ROOT_DIR, relativePath), "utf-8"));

      for (const forbiddenPattern of FORBIDDEN_PUBLIC_FRENCH) {
        expect(content).not.toMatch(forbiddenPattern);
      }
    }
  });
});

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}
