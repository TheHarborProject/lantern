import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvVariableMissingError } from "../errors/env-variable-missing-error.js";
import { resolveEnvValue } from "./resolve-env-value.js";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

describe("resolveEnvValue", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaprun-resolve-env-"));
    vi.mocked(readFileSync).mockClear();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("retourne une valeur littérale telle quelle, sans lire l'environnement", () => {
    const result = resolveEnvValue("valeur-litterale", {
      workingDirectory: dir,
      processEnv: {},
    });

    expect(result).toBe("valeur-litterale");
  });

  it("ne touche pas au disque pour une valeur littérale (aucun fichier .env requis)", () => {
    // Le répertoire ne contient aucun fichier .env : si resolveEnvValue tentait
    // de les lire pour une valeur littérale, cela resterait sans effet, mais on
    // vérifie surtout qu'aucune erreur n'est levée et que la valeur est intacte.
    const result = resolveEnvValue("http://localhost:3000", {
      workingDirectory: join(dir, "repertoire-inexistant"),
      processEnv: {},
    });

    expect(result).toBe("http://localhost:3000");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("résout ${VARIABLE} depuis process.env en priorité", () => {
    writeFileSync(join(dir, ".env"), "TOKEN=from-dot-env");
    writeFileSync(join(dir, ".env.local"), "TOKEN=from-dot-env-local");

    const result = resolveEnvValue("${TOKEN}", {
      workingDirectory: dir,
      processEnv: { TOKEN: "from-process-env" },
    });

    expect(result).toBe("from-process-env");
  });

  it("résout ${VARIABLE} depuis .env.local si absent de process.env", () => {
    writeFileSync(join(dir, ".env"), "TOKEN=from-dot-env");
    writeFileSync(join(dir, ".env.local"), "TOKEN=from-dot-env-local");

    const result = resolveEnvValue("${TOKEN}", { workingDirectory: dir, processEnv: {} });

    expect(result).toBe("from-dot-env-local");
  });

  it("résout ${VARIABLE} depuis .env si absent de process.env et de .env.local", () => {
    writeFileSync(join(dir, ".env"), "TOKEN=from-dot-env");

    const result = resolveEnvValue("${TOKEN}", { workingDirectory: dir, processEnv: {} });

    expect(result).toBe("from-dot-env");
  });

  it("recherche les fichiers .env depuis workingDirectory", () => {
    writeFileSync(join(dir, ".env"), "HOST=example.com");

    const result = resolveEnvValue("${HOST}", { workingDirectory: dir, processEnv: {} });

    expect(result).toBe("example.com");
  });

  it("supporte plusieurs interpolations dans une même chaîne, sources mixtes", () => {
    writeFileSync(join(dir, ".env"), "PORT=3000");

    const result = resolveEnvValue("${SCHEME}://${HOST}:${PORT}", {
      workingDirectory: dir,
      processEnv: { SCHEME: "http", HOST: "localhost" },
    });

    expect(result).toBe("http://localhost:3000");
  });

  it("lève ENV_VARIABLE_MISSING si la variable n'existe nulle part", () => {
    expect(() =>
      resolveEnvValue("${INTROUVABLE}", { workingDirectory: dir, processEnv: {} }),
    ).toThrow(EnvVariableMissingError);
  });

  it("ne lit chaque fichier .env qu'une seule fois par résolution, même avec plusieurs variables", () => {
    writeFileSync(join(dir, ".env"), "A=1\nSHARED=from-env");
    writeFileSync(join(dir, ".env.local"), "B=2\nSHARED=from-env-local");

    const result = resolveEnvValue("${A}-${B}-${SHARED}", {
      workingDirectory: dir,
      processEnv: {},
    });

    expect(result).toBe("1-2-from-env-local");
    expect(readFileSync).toHaveBeenCalledTimes(2);
  });

  it("ne modifie jamais process.env", () => {
    writeFileSync(join(dir, ".env"), "SNAPRUN_TEST_ISOLATION_VAR=from-file");
    const before = { ...process.env };

    const result = resolveEnvValue("${SNAPRUN_TEST_ISOLATION_VAR}", {
      workingDirectory: dir,
      processEnv: {},
    });

    expect(result).toBe("from-file");
    expect(process.env).toEqual(before);
    expect(process.env["SNAPRUN_TEST_ISOLATION_VAR"]).toBeUndefined();
  });
});
